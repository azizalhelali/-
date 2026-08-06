// الخزنة — إدارة دورة حياة المفتاح، القفل، مفتاح الإيقاف، النسخ الاحتياطي المشفّر
import { deriveKey, encryptJSON, decryptJSON, randomBytes, toB64, fromB64 } from './crypto.js';
import { metaGet, metaSet, rawAll, rawPut, rawClearAll } from './db.js';
import { emit } from './util.js';

let _key = null;          // موجود في الذاكرة فقط — لا يُخزَّن أبدًا
let _lockTimer = null;
let _autoLockMinutes = 15;

export function isUnlocked() {
  return _key !== null;
}

export function getKey() {
  if (!_key) throw new Error('الخزنة مقفلة');
  return _key;
}

export async function isInitialized() {
  return (await metaGet('salt')) !== undefined;
}

/** إنشاء خزنة جديدة بعبارة مرور */
export async function initVault(passphrase) {
  if (await isInitialized()) throw new Error('الخزنة مُهيّأة مسبقًا');
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt);
  const verifier = await encryptJSON(key, { ok: true, at: new Date().toISOString() });
  await metaSet('salt', toB64(salt));
  await metaSet('verifier', verifier);
  await metaSet('createdAt', new Date().toISOString());
  _key = key;
  armAutoLock();
  emit('vault:unlocked');
  return true;
}

/** فتح الخزنة — يفشل إذا كانت عبارة المرور خاطئة (مصادقة AES-GCM) */
export async function unlock(passphrase) {
  const saltB64 = await metaGet('salt');
  if (!saltB64) throw new Error('لا توجد خزنة على هذا الجهاز');
  const key = await deriveKey(passphrase, fromB64(saltB64));
  const verifier = await metaGet('verifier');
  try {
    await decryptJSON(key, verifier);
  } catch {
    throw new Error('عبارة المرور غير صحيحة');
  }
  _key = key;
  armAutoLock();
  emit('vault:unlocked');
  return true;
}

export function lock() {
  _key = null;
  if (_lockTimer) clearTimeout(_lockTimer);
  _lockTimer = null;
  emit('vault:locked');
}

export function setAutoLockMinutes(m) {
  _autoLockMinutes = Number(m) || 0;
  armAutoLock();
}

export function getAutoLockMinutes() {
  return _autoLockMinutes;
}

export function armAutoLock() {
  if (_lockTimer) clearTimeout(_lockTimer);
  if (!_key || !_autoLockMinutes) return;
  _lockTimer = setTimeout(() => lock(), _autoLockMinutes * 60000);
}

// إعادة تشغيل مؤقّت القفل مع كل تفاعل
['click', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => { if (_key) armAutoLock(); }, { passive: true }),
);

/** مفتاح الإيقاف — محو كامل لكل شيء على هذا الجهاز، بلا رجعة */
export async function killSwitch() {
  await rawClearAll();
  lock();
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) for (const r of regs) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* تجاهل */ }
  emit('vault:wiped');
}

/** نسخة احتياطية: تصدير السجلات كما هي — مشفّرة أصلًا */
export async function exportBackup() {
  const records = await rawAll();
  return JSON.stringify({
    format: 'pbos-encrypted-backup',
    version: 1,
    salt: await metaGet('salt'),
    verifier: await metaGet('verifier'),
    createdAt: await metaGet('createdAt'),
    exportedAt: new Date().toISOString(),
    records,
  }, null, 2);
}

/**
 * استعادة نسخة احتياطية.
 * تتطلب عبارة مرور النسخة نفسها — نتحقق منها قبل الكتابة.
 */
export async function importBackup(json, passphrase) {
  const data = JSON.parse(json);
  if (data.format !== 'pbos-encrypted-backup') throw new Error('ملف نسخة غير معروف');
  const key = await deriveKey(passphrase, fromB64(data.salt));
  try {
    await decryptJSON(key, data.verifier);
  } catch {
    throw new Error('عبارة المرور لا تطابق هذه النسخة');
  }
  await metaSet('salt', data.salt);
  await metaSet('verifier', data.verifier);
  await metaSet('createdAt', data.createdAt || new Date().toISOString());
  for (const rec of data.records || []) await rawPut(rec);
  _key = key;
  armAutoLock();
  emit('vault:unlocked');
  return (data.records || []).length;
}
