// مركز القيادة — القرارات، المخاطر، الفرص، ملخّص اليوم
import { el, pageHeader, statCard, section, toast, spinner, confirmDialog, emptyState } from '../ui.js';
import { T, list, put, settings, remove } from '../../core/store.js';
import { pulse, generateBrief } from '../../ai/council.js';
import { aiReady } from '../../ai/provider.js';
import { money, fmtRelative, today } from '../../core/util.js';

export function renderExecutive(root) {
  let busy = false;

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مساء الخير';
    return 'مساء الخير';
  }

  async function runBrief() {
    if (busy) return;
    if (!aiReady()) {
      toast('فعّل طبقة الذكاء وأضف مفتاح API من الإعدادات', 'warn');
      location.hash = '#/settings';
      return;
    }
    busy = true;
    const host = root.querySelector('.brief-body');
    host.innerHTML = '';
    host.append(spinner('المجلس يقرأ حالة عملك…'));
    try {
      await generateBrief();
      toast('جهّز المجلس ملخّص اليوم', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      busy = false;
      draw();
    }
  }

  async function setDecision(d, status) {
    await put(T.DECISION, { status, decidedAt: new Date().toISOString() }, d.id);
    toast(status === 'approved' ? 'اعتُمد القرار' : 'رُفض القرار', 'ok');
    draw();
  }

  async function closeItem(type, r) {
    await put(type, { status: 'closed', closedAt: new Date().toISOString() }, r.id);
    draw();
  }

  function draw() {
    root.innerHTML = '';
    const s = settings();
    const p = pulse();
    const briefs = list(T.BRIEF);
    const latest = briefs[0] || null;

    root.append(pageHeader(
      `${greeting()}${s.ownerName ? '، ' + s.ownerName : ''}`,
      'مركز القيادة — القرارات والمخاطر والفرص فقط.',
      [{ label: '◆ ابدأ ملخّص اليوم', variant: 'primary', onClick: runBrief }],
    ));

    // نبض العمل
    root.append(el('div', { class: 'stats' },
      statCard('مهام متأخرة', p.overdue, 'تجاوزت موعدها', p.overdue ? 'bad' : ''),
      statCard('مهام اليوم', p.dueToday, 'تستحق اليوم'),
      statCard('مشاريع نشطة', p.activeProjects, ''),
      statCard('صافي الشهر', money(p.net, s.currency), `دخل ${money(p.income, s.currency)}`, p.net < 0 ? 'bad' : 'good'),
      statCard('غير محصّل', money(p.unpaid, s.currency), 'فواتير معلّقة', p.unpaid ? 'warn' : ''),
      statCard('عقود تنتهي', p.expiring, 'خلال ٣٠ يومًا', p.expiring ? 'warn' : ''),
    ));

    // ملخّص اليوم
    const briefBody = el('div', { class: 'brief-body' });
    if (latest) {
      briefBody.append(
        el('p', { class: 'brief-date', text: `آخر ملخّص: ${fmtRelative(latest.updatedAt)}${latest.date === today() ? ' · اليوم' : ''}` }),
        el('p', { class: 'brief-summary', text: latest.summary || '' }),
        latest.highlights?.length
          ? el('ul', { class: 'highlights' }, ...latest.highlights.map((h) => el('li', { text: h })))
          : null,
      );
    } else {
      briefBody.append(el('p', {
        class: 'muted',
        text: aiReady()
          ? 'لم يُنشأ ملخّص بعد. اضغط «ابدأ ملخّص اليوم» ليقرأ المجلس بياناتك ويستخرج ما يحتاج انتباهك.'
          : 'طبقة الذكاء غير مُفعّلة. أضف مفتاح API من الإعدادات ليبدأ المجلس بالعمل. بقية النظام يعمل بدونه.',
      }));
    }
    root.append(section('ملخّص اليوم', briefBody));

    // القرارات
    const pending = list(T.DECISION, (d) => d.status === 'pending');
    const decisionsBody = el('div', {});
    if (!pending.length) {
      decisionsBody.append(el('p', { class: 'muted', text: 'لا قرارات معلّقة.' }));
    } else {
      for (const d of pending) {
        decisionsBody.append(el('article', { class: 'decision' },
          el('h4', { text: d.title }),
          d.why ? el('p', { class: 'muted', text: d.why }) : null,
          d.options?.length
            ? el('ul', { class: 'options' }, ...d.options.map((o) => el('li', { text: o })))
            : null,
          el('div', { class: 'row-actions' },
            el('button', { class: 'btn primary', text: 'اعتماد', onclick: () => setDecision(d, 'approved') }),
            el('button', { class: 'btn', text: 'رفض', onclick: () => setDecision(d, 'rejected') }),
            el('button', {
              class: 'icon-btn danger', text: '🗑', title: 'حذف',
              onclick: async () => {
                if (await confirmDialog('حذف هذا القرار؟', { danger: true, confirmLabel: 'حذف' })) {
                  await remove(d.id); draw();
                }
              },
            }),
          ),
        ));
      }
    }
    root.append(section(`قرارات تنتظرك (${pending.length})`, decisionsBody));

    // المخاطر والفرص
    const risks = list(T.RISK, (r) => r.status !== 'closed');
    const opps = list(T.OPPORTUNITY, (o) => o.status !== 'closed');

    const grid = el('div', { class: 'grid-2' });

    const riskBody = el('div', {});
    if (!risks.length) riskBody.append(el('p', { class: 'muted', text: 'لا مخاطر مفتوحة.' }));
    for (const r of risks) {
      riskBody.append(el('div', { class: 'mini-row' },
        el('div', {},
          el('strong', { text: r.title }),
          el('span', { class: `badge ${sevTone(r.severity)}`, text: r.severity || 'متوسط' }),
          r.action ? el('p', { class: 'muted', text: r.action }) : null,
        ),
        el('button', { class: 'icon-btn', title: 'إغلاق', text: '✓', onclick: () => closeItem(T.RISK, r) }),
      ));
    }
    grid.append(section(`المخاطر (${risks.length})`, riskBody));

    const oppBody = el('div', {});
    if (!opps.length) oppBody.append(el('p', { class: 'muted', text: 'لا فرص مسجّلة.' }));
    for (const o of opps) {
      oppBody.append(el('div', { class: 'mini-row' },
        el('div', {},
          el('strong', { text: o.title }),
          o.why ? el('p', { class: 'muted', text: o.why }) : null,
          o.firstStep ? el('p', { class: 'step', text: `الخطوة الأولى: ${o.firstStep}` }) : null,
        ),
        el('button', { class: 'icon-btn', title: 'إغلاق', text: '✓', onclick: () => closeItem(T.OPPORTUNITY, o) }),
      ));
    }
    grid.append(section(`الفرص (${opps.length})`, oppBody));
    root.append(grid);

    if (!list(T.PROJECT).length && !list(T.CLIENT).length) {
      root.append(emptyState(
        'النظام فارغ. ابدأ بإضافة عميل أو مشروع — كلما زادت البيانات، صار المجلس أدق.',
        'الذهاب إلى المشاريع',
        () => { location.hash = '#/projects'; },
      ));
    }
  }

  function sevTone(s) {
    if (s === 'مرتفع') return 'bad';
    if (s === 'منخفض') return 'good';
    return 'warn';
  }

  draw();
}
