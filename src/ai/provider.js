// مزوّد الذكاء — اتصال مباشر من المتصفح بـ Claude API
// المفتاح يبقى داخل الخزنة المشفّرة على الجهاز. لا يمر عبر أي سيرفر وسيط.
import { settings } from '../core/store.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export class AIError extends Error {
  constructor(message, kind = 'error') {
    super(message);
    this.kind = kind;
  }
}

export function aiReady() {
  const s = settings();
  return Boolean(s.ai.enabled && s.ai.apiKey);
}

function headers(apiKey) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
    // مطلوب للسماح بالاستدعاء المباشر من المتصفح
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/**
 * استدعاء النموذج.
 * @param {object} opts
 * @param {string} opts.system  تعليمات النظام (شخصية الوكيل)
 * @param {Array}  opts.messages  [{role:'user'|'assistant', content:string}]
 * @param {object} [opts.schema]  مخطط JSON لإجبار مخرجات منظّمة
 * @param {number} [opts.maxTokens]
 * @param {string} [opts.effort]  low | medium | high | xhigh | max
 * @param {AbortSignal} [opts.signal]
 */
export async function callModel({
  system,
  messages,
  schema = null,
  maxTokens = null,
  effort = null,
  signal = null,
}) {
  const s = settings();
  if (!s.ai.enabled) throw new AIError('طبقة الذكاء معطّلة. فعّلها من الإعدادات.', 'disabled');
  if (!s.ai.apiKey) throw new AIError('لا يوجد مفتاح API. أضفه من الإعدادات.', 'nokey');

  const body = {
    model: s.ai.model || 'claude-opus-5',
    // ملاحظة: على Opus 5 التفكير مُفعّل افتراضيًا، و max_tokens سقف للتفكير + النص معًا
    max_tokens: maxTokens || s.ai.maxTokens || 8000,
    system,
    messages,
    output_config: { effort: effort || s.ai.effort || 'high' },
  };
  if (schema) {
    body.output_config.format = { type: 'json_schema', schema };
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: headers(s.ai.apiKey),
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError('أُلغي الطلب.', 'aborted');
    throw new AIError('تعذّر الوصول إلى الشبكة. تحقّق من اتصالك.', 'network');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || '';
    } catch { /* تجاهل */ }
    if (res.status === 401) throw new AIError('مفتاح API غير صالح.', 'auth');
    if (res.status === 429) throw new AIError('تجاوزت حد الطلبات. أعد المحاولة بعد قليل.', 'rate');
    if (res.status >= 500) throw new AIError('خدمة النموذج غير متاحة حاليًا.', 'server');
    throw new AIError(detail || `فشل الطلب (${res.status})`, 'request');
  }

  const data = await res.json();

  if (data.stop_reason === 'refusal') {
    throw new AIError('رفض النموذج تنفيذ هذا الطلب.', 'refusal');
  }

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return {
    text,
    json: schema ? safeJSON(text) : null,
    usage: data.usage || null,
    stopReason: data.stop_reason,
    model: data.model,
  };
}

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* تجاهل */ } }
    return null;
  }
}

/** اختبار المفتاح بطلب صغير جدًا */
export async function testConnection(apiKey, model = 'claude-opus-5') {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'اكتب: تم' }],
      output_config: { effort: 'low' },
    }),
  });
  if (res.ok) return { ok: true };
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch { /* تجاهل */ }
  return { ok: false, status: res.status, detail };
}
