// المستودع — CRUD مشفّر فوق IndexedDB مع ذاكرة عمل بعد فتح الخزنة
import { encryptJSON, decryptJSON } from './crypto.js';
import { rawPut, rawDelete, rawAll } from './db.js';
import * as vault from './vault.js';
import { uid, emit, on as onEvent } from './util.js';

/** أنواع السجلات في نظام التشغيل */
export const T = {
  // Business OS
  PROJECT: 'project',
  CLIENT: 'client',
  CONTRACT: 'contract',
  MEETING: 'meeting',
  TASK: 'task',
  // Executive Center
  DECISION: 'decision',
  RISK: 'risk',
  OPPORTUNITY: 'opportunity',
  BRIEF: 'brief',
  // Growth OS
  STRATEGY: 'strategy',
  COMPETITOR: 'competitor',
  AUDIENCE: 'audience',
  CAMPAIGN: 'campaign',
  CONTENT: 'content',
  // Knowledge OS
  KNOWLEDGE: 'knowledge',
  // Communication OS
  MESSAGE: 'message',
  // Learning OS
  SKILL: 'skill',
  LESSON: 'lesson',
  // Finance OS
  TXN: 'txn',
  INVOICE: 'invoice',
  // Automation OS
  WORKFLOW: 'workflow',
  // System
  AGENTRUN: 'agentrun',
  AUDIT: 'audit',
  SETTING: 'setting',
};

/** الأنواع التي لا تُسجَّل في سجل التدقيق (لتفادي الحلقة اللانهائية) */
const NO_AUDIT = new Set([T.AUDIT]);

let cache = new Map(); // id -> record (مفكوك التشفير)
let loaded = false;

onEvent('vault:locked', () => {
  cache = new Map();
  loaded = false;
});

/** تحميل وفك تشفير كل السجلات مرة واحدة بعد فتح الخزنة */
export async function load() {
  if (loaded) return;
  const key = vault.getKey();
  const rows = await rawAll();
  cache = new Map();
  for (const row of rows) {
    if (!row.blob) continue;
    try {
      const data = await decryptJSON(key, row.blob);
      cache.set(row.id, { id: row.id, type: row.type, updatedAt: row.updatedAt, ...data });
    } catch {
      // سجل تالف أو من مفتاح آخر — نتجاهله بدل إسقاط التطبيق
      console.warn('تعذّر فك تشفير السجل', row.id);
    }
  }
  loaded = true;
  emit('store:loaded', cache.size);
}

export function isLoaded() {
  return loaded;
}

export function all() {
  return [...cache.values()];
}

export function list(type, filterFn) {
  let out = [...cache.values()].filter((r) => r.type === type);
  if (filterFn) out = out.filter(filterFn);
  return out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function get(id) {
  return cache.get(id) || null;
}

export function count(type) {
  return list(type).length;
}

async function persist(record) {
  const key = vault.getKey();
  const { id, type, updatedAt, ...data } = record;
  const blob = await encryptJSON(key, data);
  await rawPut({ id, type, updatedAt, blob });
}

/** إنشاء أو تحديث سجل */
export async function put(type, data, id = null) {
  const now = new Date().toISOString();
  const existing = id ? cache.get(id) : null;
  const record = {
    ...(existing || {}),
    ...data,
    id: id || existing?.id || uid(type.slice(0, 3)),
    type,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  cache.set(record.id, record);
  await persist(record);
  if (!NO_AUDIT.has(type)) {
    await audit(existing ? 'تحديث' : 'إنشاء', type, record.id, data.title || data.name || '');
  }
  emit('store:changed', { type, id: record.id });
  return record;
}

export async function remove(id) {
  const rec = cache.get(id);
  if (!rec) return false;
  cache.delete(id);
  await rawDelete(id);
  if (!NO_AUDIT.has(rec.type)) {
    await audit('حذف', rec.type, id, rec.title || rec.name || '');
  }
  emit('store:changed', { type: rec.type, id });
  return true;
}

// ---- سجل التدقيق ----
export async function audit(action, entity, entityId, label = '') {
  const now = new Date().toISOString();
  const record = {
    id: uid('aud'),
    type: T.AUDIT,
    action,
    entity,
    entityId,
    label,
    createdAt: now,
    updatedAt: now,
  };
  cache.set(record.id, record);
  await persist(record);
  return record;
}

// ---- الإعدادات (سجل مفرد مشفّر) ----
const SETTINGS_ID = 'settings_singleton';

export const DEFAULT_SETTINGS = {
  businessName: '',
  ownerName: '',
  currency: 'SAR',
  autoLockMinutes: 15,
  ai: {
    enabled: false,
    apiKey: '',
    model: 'claude-opus-5',
    effort: 'high',
    maxTokens: 8000,
  },
  connections: {}, // اسم المصدر -> { status, note }
};

export function settings() {
  const s = cache.get(SETTINGS_ID);
  if (!s) return structuredClone(DEFAULT_SETTINGS);
  return { ...structuredClone(DEFAULT_SETTINGS), ...s, ai: { ...DEFAULT_SETTINGS.ai, ...(s.ai || {}) } };
}

export async function saveSettings(patch) {
  const merged = { ...settings(), ...patch };
  const now = new Date().toISOString();
  const record = { ...merged, id: SETTINGS_ID, type: T.SETTING, updatedAt: now };
  cache.set(SETTINGS_ID, record);
  await persist(record);
  emit('store:changed', { type: T.SETTING, id: SETTINGS_ID });
  emit('settings:changed', record);
  return record;
}

/** بحث نصي عبر كل السجلات (محلي بالكامل) */
export function search(query, types = null) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const r of cache.values()) {
    if (r.type === T.AUDIT || r.type === T.SETTING) continue;
    if (types && !types.includes(r.type)) continue;
    const hay = JSON.stringify(r).toLowerCase();
    if (hay.includes(q)) out.push(r);
  }
  return out.slice(0, 60);
}
