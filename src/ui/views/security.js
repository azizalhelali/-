// الأمن والخصوصية — سجل التدقيق، النسخ الاحتياطي، مفتاح الإيقاف، المصادر
import { el, pageHeader, section, statCard, toast, confirmDialog, formModal } from '../ui.js';
import { T, list, settings, saveSettings } from '../../core/store.js';
import * as vault from '../../core/vault.js';
import { fmtRelative, download, num } from '../../core/util.js';

const SOURCES = [
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'calendar', label: 'التقويم' },
  { key: 'drive', label: 'Google Drive' },
  { key: 'onedrive', label: 'OneDrive' },
  { key: 'dropbox', label: 'Dropbox' },
  { key: 'github', label: 'GitHub' },
  { key: 'notion', label: 'Notion' },
  { key: 'slack', label: 'Slack' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x', label: 'X' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'website', label: 'موقعك' },
];

export function renderSecurity(root) {
  async function doBackup() {
    const json = await vault.exportBackup();
    const name = `pbos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    download(name, json);
    toast('نُزّلت نسخة مشفّرة. لا تُفتح إلا بعبارة مرورك.', 'ok');
  }

  async function doRestore() {
    const input = el('input', { type: 'file', accept: '.json' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = await formModal({
        title: 'استعادة نسخة',
        fields: [{
          name: 'pass', label: 'عبارة مرور النسخة', type: 'password', required: true,
          hint: 'العبارة التي كانت مستخدمة وقت إنشاء النسخة.',
        }],
      });
      if (!data) return;
      try {
        const n = await vault.importBackup(text, data.pass);
        toast(`استُعيد ${n} سجلًا. أعد تحميل الصفحة.`, 'ok', 6000);
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    input.click();
  }

  async function doKill() {
    const step1 = await confirmDialog(
      'مفتاح الإيقاف يمحو كل البيانات على هذا الجهاز نهائيًا: المشاريع، العملاء، العقود، المالية، المعرفة، ومفتاح API. لا يمكن التراجع.',
      { danger: true, confirmLabel: 'فهمت، تابع' },
    );
    if (!step1) return;
    const data = await formModal({
      title: 'تأكيد المحو النهائي',
      submitLabel: 'محو كل شيء',
      fields: [{
        name: 'confirm', label: 'اكتب كلمة «محو» للتأكيد', required: true,
        placeholder: 'محو',
      }],
    });
    if (!data || data.confirm.trim() !== 'محو') {
      toast('أُلغي المحو', 'info');
      return;
    }
    await vault.killSwitch();
    toast('مُحيت كل البيانات', 'ok');
    setTimeout(() => location.reload(), 900);
  }

  async function toggleSource(key) {
    const s = settings();
    const conns = { ...(s.connections || {}) };
    if (conns[key]?.status === 'linked') {
      delete conns[key];
    } else {
      const data = await formModal({
        title: 'ربط مصدر',
        fields: [{
          name: 'note', label: 'ملاحظة الربط', type: 'textarea', rows: 3,
          placeholder: 'مثال: حساب العمل فقط، صلاحية قراءة',
        }],
      });
      if (data === null) return;
      conns[key] = { status: 'linked', note: data.note, at: new Date().toISOString() };
    }
    await saveSettings({ connections: conns });
    draw();
  }

  function draw() {
    root.innerHTML = '';
    const s = settings();
    const audits = list(T.AUDIT);
    const linked = Object.values(s.connections || {}).filter((c) => c.status === 'linked').length;

    root.append(pageHeader('الأمن والخصوصية', 'بياناتك على جهازك، مشفّرة، وتحت سيطرتك الكاملة.'));

    root.append(el('div', { class: 'stats' },
      statCard('حالة التشفير', 'AES-256-GCM', 'مفتاح مشتق من عبارة مرورك', 'good'),
      statCard('موقع البيانات', 'هذا الجهاز', 'لا سحابة، لا سيرفر', 'good'),
      statCard('مصادر مربوطة', num(linked), `من ${SOURCES.length}`),
      statCard('أحداث مُدقّقة', num(audits.length), 'سجل غير قابل للتجاوز'),
    ));

    // ضمانات
    root.append(section('ما الذي يضمنه هذا النظام',
      el('ul', { class: 'guarantees' },
        el('li', { text: 'لا يُخزَّن أي كلمة مرور. عبارة مرورك لا تُحفظ في أي مكان — تُشتق منها مفاتيح التشفير في الذاكرة فقط.' }),
        el('li', { text: 'كل سجل يُشفَّر قبل كتابته على القرص. من يفتح قاعدة البيانات بدون عبارتك يرى ضجيجًا.' }),
        el('li', { text: 'لا يوجد سيرفر خلفي. لا تُرسل بياناتك إلى أي جهة إلا عندما تطلب أنت تشغيل وكيل.' }),
        el('li', { text: 'عند تشغيل وكيل، يُرسل السياق المعروض في زر «ما الذي يراه؟» فقط — يمكنك معاينته قبل الإرسال.' }),
        el('li', { text: 'مفتاح API يُخزَّن مشفّرًا داخل الخزنة نفسها، ويذهب مباشرةً إلى مزوّد النموذج بلا وسيط.' }),
        el('li', { text: 'القفل التلقائي يمحو المفتاح من الذاكرة بعد فترة خمول.' }),
      ),
    ));

    // مصادر الذكاء
    const sourceGrid = el('div', { class: 'source-grid' },
      ...SOURCES.map((src) => {
        const on = s.connections?.[src.key]?.status === 'linked';
        return el('button', {
          class: `source${on ? ' linked' : ''}`,
          onclick: () => toggleSource(src.key),
        },
        el('span', { class: 'source-name', text: src.label }),
        el('span', { class: 'source-state', text: on ? 'مربوط' : 'غير مربوط' }),
        );
      }),
    );
    root.append(section('مصادر الذكاء',
      el('p', { class: 'muted', text: 'اربط ما تريد فقط. الربط هنا يسجّل نطاق الوصول ويُدرج المصدر في سياق الوكلاء — بلا كلمات مرور، عبر OAuth عند التفعيل الكامل.' }),
      sourceGrid,
    ));

    // النسخ والقفل
    root.append(section('التحكّم',
      el('div', { class: 'control-grid' },
        el('div', { class: 'control' },
          el('h4', { text: 'نسخة احتياطية مشفّرة' }),
          el('p', { class: 'muted', text: 'ملف واحد يحتوي كل شيء، مشفّر بعبارة مرورك. احتفظ به أينما شئت.' }),
          el('button', { class: 'btn primary', text: 'تنزيل نسخة', onclick: doBackup }),
        ),
        el('div', { class: 'control' },
          el('h4', { text: 'استعادة' }),
          el('p', { class: 'muted', text: 'يتطلب عبارة مرور النسخة نفسها.' }),
          el('button', { class: 'btn', text: 'استعادة من ملف', onclick: doRestore }),
        ),
        el('div', { class: 'control' },
          el('h4', { text: 'قفل فوري' }),
          el('p', { class: 'muted', text: 'يمحو مفتاح التشفير من الذاكرة الآن.' }),
          el('button', { class: 'btn', text: 'اقفل الآن', onclick: () => { vault.lock(); } }),
        ),
        el('div', { class: 'control danger-zone' },
          el('h4', { text: 'مفتاح الإيقاف' }),
          el('p', { class: 'muted', text: 'محو كامل لكل شيء على هذا الجهاز. بلا رجعة.' }),
          el('button', { class: 'btn danger', text: 'محو كل شيء', onclick: doKill }),
        ),
      ),
    ));

    // سجل التدقيق
    const log = el('div', { class: 'audit' });
    if (!audits.length) log.append(el('p', { class: 'muted', text: 'لا أحداث بعد.' }));
    for (const a of audits.slice(0, 80)) {
      log.append(el('div', { class: 'audit-row' },
        el('span', { class: 'audit-action', text: a.action }),
        el('span', { class: 'audit-entity', text: a.entity }),
        el('span', { class: 'audit-label', text: a.label || a.entityId }),
        el('span', { class: 'audit-time', text: fmtRelative(a.updatedAt) }),
      ));
    }
    root.append(section(`سجل التدقيق (${audits.length})`, log));
  }

  draw();
}
