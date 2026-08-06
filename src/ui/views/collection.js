// عارض عام لأي نوع سجل: قائمة + إضافة + تعديل + حذف + اقتراح من وكيل
import { el, pageHeader, formModal, confirmDialog, toast, emptyState, section, spinner } from '../ui.js';
import { list, put, remove } from '../../core/store.js';
import { askAgent } from '../../ai/council.js';
import { aiReady } from '../../ai/provider.js';
import { mdLite } from '../../core/util.js';

/**
 * @param {HTMLElement} root
 * @param {object} cfg
 *   type, title, subtitle, addLabel, fields, row(record), tabs?, agent? {id, label, prompt(records)}
 */
export function renderCollection(root, cfg) {
  const state = { filter: cfg.tabs?.[0]?.value ?? null };

  function records() {
    let rows = list(cfg.type);
    if (state.filter && cfg.tabs) {
      const tab = cfg.tabs.find((t) => t.value === state.filter);
      if (tab?.match) rows = rows.filter(tab.match);
    }
    return rows;
  }

  async function openForm(record = null) {
    const values = record ? { ...record } : (cfg.defaults || {});
    const data = await formModal({
      title: record ? `تعديل: ${record.title || record.name || ''}` : cfg.addLabel || 'إضافة',
      fields: cfg.fields,
      values,
      wide: cfg.fields.length > 6,
    });
    if (!data) return;
    await put(cfg.type, data, record?.id || null);
    toast(record ? 'تم التحديث' : 'تمت الإضافة', 'ok');
    draw();
  }

  async function del(record) {
    const ok = await confirmDialog(
      `حذف "${record.title || record.name || 'هذا السجل'}" نهائيًا؟`,
      { danger: true, confirmLabel: 'حذف' },
    );
    if (!ok) return;
    await remove(record.id);
    toast('تم الحذف', 'ok');
    draw();
  }

  async function runAgent() {
    if (!aiReady()) {
      toast('فعّل طبقة الذكاء وأضف مفتاح API من الإعدادات', 'warn');
      return;
    }
    const host = el('div', {}, spinner('الوكيل يحلّل بياناتك…'));
    const panel = section(`اقتراح: ${cfg.agent.label}`, host);
    root.querySelector('.agent-panel')?.remove();
    panel.classList.add('agent-panel');
    root.querySelector('.page-head').after(panel);
    try {
      const res = await askAgent(cfg.agent.id, cfg.agent.prompt(records()));
      host.innerHTML = mdLite(res.text);
    } catch (e) {
      host.innerHTML = '';
      host.append(el('p', { class: 'error', text: e.message }));
    }
  }

  function draw() {
    root.innerHTML = '';
    const actions = [{ label: cfg.addLabel || '+ إضافة', variant: 'primary', onClick: () => openForm() }];
    if (cfg.agent) actions.unshift({ label: `◆ ${cfg.agent.label}`, onClick: runAgent });
    root.append(pageHeader(cfg.title, cfg.subtitle, actions));

    if (cfg.tabs) {
      root.append(el('div', { class: 'tabs' },
        ...cfg.tabs.map((t) => el('button', {
          class: `tab${state.filter === t.value ? ' active' : ''}`,
          text: t.label,
          onclick: () => { state.filter = t.value; draw(); },
        })),
      ));
    }

    const rows = records();
    if (!rows.length) {
      root.append(emptyState(cfg.emptyText || 'لا توجد سجلات بعد.', cfg.addLabel || '+ إضافة', () => openForm()));
      return;
    }

    const listEl = el('div', { class: 'rows' });
    for (const r of rows) {
      const view = cfg.row(r);
      listEl.append(el('article', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title' },
            el('span', { text: view.title || '(بلا عنوان)' }),
            view.badge ? el('span', { class: `badge ${view.badge.tone || ''}`, text: view.badge.text }) : null,
          ),
          view.meta?.length
            ? el('div', { class: 'row-meta' }, ...view.meta.filter(Boolean).map((m) => el('span', { text: m })))
            : null,
          view.body ? el('p', { class: 'row-body', text: view.body }) : null,
        ),
        el('div', { class: 'row-actions' },
          ...(view.extraActions || []).map((a) => el('button', {
            class: 'icon-btn', title: a.title, text: a.icon,
            onclick: async () => { await a.onClick(r); draw(); },
          })),
          el('button', { class: 'icon-btn', title: 'تعديل', text: '✎', onclick: () => openForm(r) }),
          el('button', { class: 'icon-btn danger', title: 'حذف', text: '🗑', onclick: () => del(r) }),
        ),
      ));
    }
    root.append(listEl);
  }

  draw();
}
