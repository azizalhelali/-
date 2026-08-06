// أدوات مشتركة: المعرّفات، ناقل الأحداث، التواريخ، الأرقام

export function uid(prefix = 'r') {
  const b = crypto.getRandomValues(new Uint8Array(12));
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

// ---- ناقل أحداث بسيط ----
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (set) for (const fn of [...set]) fn(payload);
  const star = listeners.get('*');
  if (star) for (const fn of [...star]) fn({ event, payload });
}

// ---- تواريخ ----
const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return fmtDate(iso);
}

export function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - new Date(today()).getTime();
  return Math.round(ms / 86400000);
}

export function money(n, currency = 'SAR') {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('ar', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${v.toLocaleString('ar')} ${currency}`;
  }
}

export function num(n) {
  return (Number(n) || 0).toLocaleString('ar');
}

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** تحويل نص بسيط (سطور، **عريض**، - قوائم) إلى HTML آمن */
export function mdLite(text) {
  const safe = escapeHTML(text);
  const lines = safe.split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(t.replace(/^[-*•]\s+/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (/^#{1,4}\s+/.test(t)) html += `<h4>${inline(t.replace(/^#{1,4}\s+/, ''))}</h4>`;
      else if (t) html += `<p>${inline(t)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;

  function inline(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }
}

export function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
