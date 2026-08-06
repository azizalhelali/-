// Finance OS — التدفق النقدي والربحية والتوقعات (ليس برنامج محاسبة)
import { el, pageHeader, statCard, section, formModal, toast, confirmDialog, spinner, emptyState } from '../ui.js';
import { T, list, put, remove, settings } from '../../core/store.js';
import { askAgent } from '../../ai/council.js';
import { aiReady } from '../../ai/provider.js';
import { money, fmtDate, mdLite, daysUntil, today } from '../../core/util.js';

const CATEGORIES = [
  'خدمات', 'اشتراكات', 'أدوات', 'تسويق', 'ضرائب ورسوم', 'مقاولون', 'أخرى',
];

export function renderFinance(root) {
  function monthKey(offset = 0) {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    return d.toISOString().slice(0, 7);
  }

  function monthTotals(key) {
    const rows = list(T.TXN, (t) => String(t.date || '').startsWith(key));
    const income = rows.filter((t) => t.kind === 'income').reduce((a, t) => a + (+t.amount || 0), 0);
    const expense = rows.filter((t) => t.kind === 'expense').reduce((a, t) => a + (+t.amount || 0), 0);
    return { income, expense, net: income - expense, count: rows.length };
  }

  async function addTxn(rec = null) {
    const data = await formModal({
      title: rec ? 'تعديل حركة' : 'حركة مالية جديدة',
      fields: [
        { name: 'kind', label: 'النوع', type: 'select', options: [
          { value: 'income', label: 'دخل' }, { value: 'expense', label: 'مصروف' },
        ] },
        { name: 'title', label: 'الوصف', required: true },
        { name: 'amount', label: 'المبلغ', type: 'number', required: true, step: '0.01' },
        { name: 'date', label: 'التاريخ', type: 'date', default: today() },
        { name: 'category', label: 'التصنيف', type: 'select', options: CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: 'clientName', label: 'العميل' },
      ],
      values: rec || { kind: 'income', date: today() },
    });
    if (!data) return;
    await put(T.TXN, data, rec?.id || null);
    toast('حُفظت الحركة', 'ok');
    draw();
  }

  async function addInvoice(rec = null) {
    const data = await formModal({
      title: rec ? 'تعديل فاتورة' : 'فاتورة جديدة',
      fields: [
        { name: 'title', label: 'الوصف', required: true },
        { name: 'clientName', label: 'العميل' },
        { name: 'amount', label: 'المبلغ', type: 'number', required: true, step: '0.01' },
        { name: 'issuedAt', label: 'تاريخ الإصدار', type: 'date', default: today() },
        { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
        { name: 'status', label: 'الحالة', type: 'select', options: [
          { value: 'draft', label: 'مسودة' }, { value: 'sent', label: 'مُرسلة' }, { value: 'paid', label: 'مدفوعة' },
        ] },
      ],
      values: rec || { status: 'draft', issuedAt: today() },
    });
    if (!data) return;
    await put(T.INVOICE, data, rec?.id || null);
    toast('حُفظت الفاتورة', 'ok');
    draw();
  }

  async function runAgent() {
    if (!aiReady()) { toast('فعّل طبقة الذكاء من الإعدادات', 'warn'); return; }
    const host = el('div', {}, spinner('وكيل المالية يحسب…'));
    root.querySelector('.agent-panel')?.remove();
    const panel = section('تحليل وكيل المالية', host);
    panel.classList.add('agent-panel');
    root.querySelector('.page-head').after(panel);
    try {
      const res = await askAgent('finance',
        'حلّل وضعي المالي: كم شهرًا يكفي النقد الحالي بمعدل المصروف الأخير؟ ما أكبر بند مصروف يمكن قصّه؟ '
        + 'هل هناك عميل أو خدمة تحتاج إعادة تسعير؟ أعطني الأرقام وطريقة حسابها.');
      host.innerHTML = mdLite(res.text);
    } catch (e) {
      host.innerHTML = '';
      host.append(el('p', { class: 'error', text: e.message }));
    }
  }

  function draw() {
    root.innerHTML = '';
    const cur = settings().currency;
    const m0 = monthTotals(monthKey(0));
    const m1 = monthTotals(monthKey(1));
    const m2 = monthTotals(monthKey(2));

    const allTxns = list(T.TXN);
    const totalIncome = allTxns.filter((t) => t.kind === 'income').reduce((a, t) => a + (+t.amount || 0), 0);
    const totalExpense = allTxns.filter((t) => t.kind === 'expense').reduce((a, t) => a + (+t.amount || 0), 0);
    const cash = totalIncome - totalExpense;
    const avgBurn = [m0, m1, m2].filter((m) => m.count).length
      ? [m0, m1, m2].reduce((a, m) => a + m.expense, 0) / Math.max(1, [m0, m1, m2].filter((m) => m.count).length)
      : 0;
    const runway = avgBurn > 0 ? (cash / avgBurn) : null;

    const invoices = list(T.INVOICE);
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    const unpaidTotal = unpaid.reduce((a, i) => a + (+i.amount || 0), 0);

    const actions = [
      { label: '+ حركة', variant: 'primary', onClick: () => addTxn() },
      { label: '+ فاتورة', onClick: () => addInvoice() },
    ];
    if (aiReady()) actions.unshift({ label: '◆ حلّل وضعي المالي', onClick: runAgent });
    root.append(pageHeader('المالية', 'التدفق النقدي والربحية والتوقعات.', actions));

    root.append(el('div', { class: 'stats' },
      statCard('النقد التراكمي', money(cash, cur), 'دخل − مصروف', cash < 0 ? 'bad' : 'good'),
      statCard('صافي هذا الشهر', money(m0.net, cur), `دخل ${money(m0.income, cur)}`, m0.net < 0 ? 'bad' : 'good'),
      statCard('مصروف هذا الشهر', money(m0.expense, cur), ''),
      statCard('مدى النقد', runway === null ? '—' : `${runway.toFixed(1)} شهر`,
        avgBurn ? `بمعدل حرق ${money(Math.round(avgBurn), cur)}` : 'لا بيانات كافية',
        runway !== null && runway < 3 ? 'bad' : ''),
      statCard('غير محصّل', money(unpaidTotal, cur), `${unpaid.length} فاتورة`, unpaidTotal ? 'warn' : ''),
    ));

    // مقارنة ثلاثة أشهر
    const months = [
      { key: monthKey(2), ...m2 }, { key: monthKey(1), ...m1 }, { key: monthKey(0), ...m0 },
    ];
    const peak = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
    root.append(section('آخر ثلاثة أشهر', el('div', { class: 'bars' },
      ...months.map((m) => el('div', { class: 'bar-group' },
        el('div', { class: 'bar-pair' },
          el('div', {
            class: 'bar income',
            style: `height:${Math.round((m.income / peak) * 100)}%`,
            title: `دخل ${money(m.income, cur)}`,
          }),
          el('div', {
            class: 'bar expense',
            style: `height:${Math.round((m.expense / peak) * 100)}%`,
            title: `مصروف ${money(m.expense, cur)}`,
          }),
        ),
        el('span', { class: 'bar-label', text: m.key }),
        el('span', { class: `bar-net ${m.net < 0 ? 'bad' : 'good'}`, text: money(m.net, cur) }),
      )),
    )));

    // الفواتير
    const invBody = el('div', {});
    if (!invoices.length) invBody.append(el('p', { class: 'muted', text: 'لا فواتير.' }));
    for (const i of invoices) {
      const late = i.status !== 'paid' && daysUntil(i.dueDate) < 0;
      invBody.append(el('div', { class: 'mini-row' },
        el('div', {},
          el('strong', { text: i.title }),
          el('span', {
            class: `badge ${i.status === 'paid' ? 'good' : late ? 'bad' : 'warn'}`,
            text: i.status === 'paid' ? 'مدفوعة' : late ? 'متأخرة' : 'معلّقة',
          }),
          el('p', { class: 'muted', text: `${i.clientName || '—'} · ${money(i.amount, cur)} · استحقاق ${i.dueDate ? fmtDate(i.dueDate) : '—'}` }),
        ),
        el('div', { class: 'row-actions' },
          i.status !== 'paid'
            ? el('button', {
              class: 'icon-btn', title: 'تعليم كمدفوعة', text: '✓',
              onclick: async () => {
                await put(T.INVOICE, { status: 'paid' }, i.id);
                await put(T.TXN, {
                  kind: 'income', title: `تحصيل: ${i.title}`, amount: i.amount,
                  date: today(), category: 'خدمات', clientName: i.clientName,
                });
                toast('سُجّلت كدخل', 'ok');
                draw();
              },
            })
            : null,
          el('button', { class: 'icon-btn', title: 'تعديل', text: '✎', onclick: () => addInvoice(i) }),
          el('button', {
            class: 'icon-btn danger', title: 'حذف', text: '🗑',
            onclick: async () => {
              if (await confirmDialog('حذف الفاتورة؟', { danger: true, confirmLabel: 'حذف' })) {
                await remove(i.id); draw();
              }
            },
          }),
        ),
      ));
    }
    root.append(section(`الفواتير (${invoices.length})`, invBody));

    // الحركات
    const txBody = el('div', { class: 'rows' });
    if (!allTxns.length) {
      txBody.append(emptyState('لا حركات مالية بعد.', '+ حركة', () => addTxn()));
    }
    for (const t of allTxns.slice(0, 60)) {
      txBody.append(el('article', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title' },
            el('span', { text: t.title }),
            el('span', {
              class: `badge ${t.kind === 'income' ? 'good' : ''}`,
              text: t.kind === 'income' ? 'دخل' : 'مصروف',
            }),
          ),
          el('div', { class: 'row-meta' },
            el('span', { text: money(t.amount, cur) }),
            el('span', { text: t.date ? fmtDate(t.date) : '—' }),
            t.category ? el('span', { text: t.category }) : null,
            t.clientName ? el('span', { text: t.clientName }) : null,
          ),
        ),
        el('div', { class: 'row-actions' },
          el('button', { class: 'icon-btn', title: 'تعديل', text: '✎', onclick: () => addTxn(t) }),
          el('button', {
            class: 'icon-btn danger', title: 'حذف', text: '🗑',
            onclick: async () => {
              if (await confirmDialog('حذف الحركة؟', { danger: true, confirmLabel: 'حذف' })) {
                await remove(t.id); draw();
              }
            },
          }),
        ),
      ));
    }
    root.append(section('الحركات', txBody));
  }

  draw();
}
