// أدوات الواجهة: عناصر، نوافذ، نماذج، تنبيهات
import { escapeHTML } from '../core/util.js';

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// ---- تنبيهات ----
let toastHost = null;

export function toast(message, kind = 'info', ms = 3600) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host' });
    document.body.append(toastHost);
  }
  const t = el('div', { class: `toast toast-${kind}`, text: message });
  toastHost.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 250);
  }, ms);
}

// ---- نافذة ----
export function modal({ title, body, actions = [], onClose = null, wide = false }) {
  const overlay = el('div', { class: 'overlay' });
  const box = el('div', { class: `modal${wide ? ' modal-wide' : ''}` });
  const close = () => { overlay.remove(); onClose?.(); };

  box.append(
    el('div', { class: 'modal-head' },
      el('h3', { text: title }),
      el('button', { class: 'icon-btn', 'aria-label': 'إغلاق', onclick: close, text: '✕' }),
    ),
    el('div', { class: 'modal-body' }, body),
  );
  if (actions.length) {
    box.append(el('div', { class: 'modal-foot' },
      ...actions.map((a) => el('button', {
        class: `btn ${a.variant || ''}`,
        onclick: () => a.onClick?.(close),
        text: a.label,
      })),
    ));
  }
  overlay.append(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  document.body.append(overlay);
  setTimeout(() => box.querySelector('input,textarea,select,button')?.focus(), 50);
  return { close, box };
}

export function confirmDialog(message, { danger = false, confirmLabel = 'تأكيد' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    modal({
      title: 'تأكيد',
      body: el('p', { class: 'muted', text: message }),
      onClose: () => { if (!done) resolve(false); },
      actions: [
        { label: 'إلغاء', onClick: (close) => { done = true; resolve(false); close(); } },
        {
          label: confirmLabel,
          variant: danger ? 'danger' : 'primary',
          onClick: (close) => { done = true; resolve(true); close(); },
        },
      ],
    });
  });
}

// ---- نموذج ----
/**
 * @param {Array} fields [{name,label,type,options,required,placeholder,hint,rows}]
 * @returns {Promise<object|null>}
 */
export function formModal({ title, fields, values = {}, submitLabel = 'حفظ', wide = false }) {
  return new Promise((resolve) => {
    let done = false;
    const form = el('form', { class: 'form', onsubmit: (e) => e.preventDefault() });

    for (const f of fields) {
      const id = `f_${f.name}`;
      const v = values[f.name] ?? f.default ?? '';
      let input;
      if (f.type === 'textarea') {
        input = el('textarea', { id, name: f.name, rows: f.rows || 4, placeholder: f.placeholder || '' });
        input.value = v;
      } else if (f.type === 'select') {
        input = el('select', { id, name: f.name });
        for (const o of f.options || []) {
          const opt = el('option', { value: o.value, text: o.label });
          if (String(o.value) === String(v)) opt.selected = true;
          input.append(opt);
        }
      } else if (f.type === 'checkbox') {
        input = el('input', { id, name: f.name, type: 'checkbox' });
        input.checked = Boolean(v);
      } else {
        input = el('input', {
          id, name: f.name, type: f.type || 'text',
          placeholder: f.placeholder || '',
          step: f.step || null,
        });
        input.value = v;
      }
      if (f.required) input.required = true;

      form.append(el('div', { class: `field${f.type === 'checkbox' ? ' field-inline' : ''}` },
        el('label', { for: id, text: f.label }),
        input,
        f.hint ? el('small', { class: 'hint', text: f.hint }) : null,
      ));
    }

    const collect = () => {
      const out = {};
      for (const f of fields) {
        const node = form.elements[f.name];
        if (!node) continue;
        if (f.type === 'checkbox') out[f.name] = node.checked;
        else if (f.type === 'number') out[f.name] = node.value === '' ? null : Number(node.value);
        else out[f.name] = node.value.trim();
      }
      return out;
    };

    const { close } = modal({
      title,
      body: form,
      wide,
      onClose: () => { if (!done) resolve(null); },
      actions: [
        { label: 'إلغاء', onClick: (c) => { done = true; resolve(null); c(); } },
        {
          label: submitLabel,
          variant: 'primary',
          onClick: (c) => {
            if (!form.reportValidity()) return;
            done = true;
            resolve(collect());
            c();
          },
        },
      ],
    });

    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!form.reportValidity()) return;
        done = true;
        resolve(collect());
        close();
      }
    });
  });
}

// ---- مكوّنات جاهزة ----
export function pageHeader(title, subtitle, actions = []) {
  return el('header', { class: 'page-head' },
    el('div', {},
      el('h1', { text: title }),
      subtitle ? el('p', { class: 'muted', text: subtitle }) : null,
    ),
    el('div', { class: 'page-actions' },
      ...actions.map((a) => el('button', {
        class: `btn ${a.variant || ''}`,
        onclick: a.onClick,
        text: a.label,
      })),
    ),
  );
}

export function statCard(label, value, hint = '', tone = '') {
  return el('div', { class: `stat ${tone}` },
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', text: String(value) }),
    hint ? el('span', { class: 'stat-hint', text: hint }) : null,
  );
}

export function emptyState(text, actionLabel = null, onAction = null) {
  return el('div', { class: 'empty' },
    el('p', { text }),
    actionLabel ? el('button', { class: 'btn primary', text: actionLabel, onclick: onAction }) : null,
  );
}

export function badge(text, tone = '') {
  return el('span', { class: `badge ${tone}`, text });
}

export function section(title, ...children) {
  return el('section', { class: 'card' },
    title ? el('h2', { class: 'card-title', text: title }) : null,
    ...children,
  );
}

export function spinner(label = 'جارٍ العمل…') {
  return el('div', { class: 'spinner' }, el('span', { class: 'dot' }), el('span', { text: label }));
}

export function renderHTML(container, htmlStr) {
  container.innerHTML = htmlStr;
  return container;
}

export { escapeHTML };
