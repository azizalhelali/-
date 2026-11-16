// الحسابات المحلية المشفّرة.
// كل حساب: اسم + ملح على الجهاز، وبياناته كتلة مشفّرة بـ AES-256-GCM
// بمفتاح مشتق من كلمة المرور (PBKDF2-SHA256، ٦٠٠٬٠٠٠ دورة). كلمة المرور لا تُحفظ أبدًا.
// «ابقَ مسجّلًا» يحفظ المفتاح كـ CryptoKey غير قابل للاستخراج في IndexedDB على هذا الجهاز فقط.

const ACCOUNTS = 'studio.accounts';
const SESSION = 'studio.session';
const blobKey = (id) => `studio.acct.${id}`;
const ITER = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch { return null; }
  return null;
}

export function listAccounts() {
  try { return JSON.parse(ls(ACCOUNTS)) || []; } catch { return []; }
}
function writeAccounts(list) { ls(ACCOUNTS, JSON.stringify(list)); }

async function derive(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ iv: b64(iv), ct: b64(ct) });
}
async function open(key, raw) {
  const { iv, ct } = JSON.parse(raw);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}

/* ---- IndexedDB: مفتاح الجلسة فقط ---- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('studio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('keys', mode);
    const req = fn(tx.objectStore('keys'));
    tx.oncomplete = () => { db.close(); res(req?.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

/** الحساب المفتوح حاليًا */
let current = null; // { id, name, key }

export const account = () => current;

export async function createAccount(name, password, stay, initialData = {}) {
  const list = listAccounts();
  if (list.some((a) => a.name === name)) throw new Error('يوجد حساب بهذا الاسم على هذا الجهاز.');
  const id = crypto.randomUUID();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  ls(blobKey(id), await seal(key, initialData));
  writeAccounts([...list, { id, name, salt: b64(salt), createdAt: Date.now() }]);
  current = { id, name, key };
  await remember(stay);
  return initialData;
}

export async function login(id, password, stay) {
  const a = listAccounts().find((x) => x.id === id);
  if (!a) throw new Error('الحساب غير موجود.');
  const key = await derive(password, unb64(a.salt));
  let data;
  try { data = await open(key, ls(blobKey(id))); } catch { throw new Error('كلمة المرور غير صحيحة.'); }
  current = { id, name: a.name, key };
  await remember(stay);
  return data;
}

/** يحاول فتح آخر حساب تلقائيًا إن اختار المستخدم «ابقَ مسجّلًا» */
export async function resume() {
  const id = ls(SESSION);
  if (!id) return null;
  const a = listAccounts().find((x) => x.id === id);
  if (!a) return null;
  try {
    const key = await idbDo('readonly', (s) => s.get(id));
    if (!key) return null;
    const data = await open(key, ls(blobKey(id)));
    current = { id, name: a.name, key };
    return data;
  } catch { return null; }
}

async function remember(stay) {
  if (!current) return;
  try {
    if (stay) {
      await idbDo('readwrite', (s) => s.put(current.key, current.id));
      ls(SESSION, current.id);
    } else {
      await idbDo('readwrite', (s) => s.delete(current.id));
      ls(SESSION, null);
    }
  } catch { /* بدون IndexedDB: يبقى الدخول لهذه الجلسة فقط */ }
}

export async function persist(data) {
  if (!current) return;
  ls(blobKey(current.id), await seal(current.key, data));
}

export async function logout() {
  if (current) { try { await idbDo('readwrite', (s) => s.delete(current.id)); } catch { /* تجاهل */ } }
  ls(SESSION, null);
  current = null;
}

export async function deleteAccount() {
  if (!current) return;
  const id = current.id;
  await logout();
  ls(blobKey(id), null);
  writeAccounts(listAccounts().filter((a) => a.id !== id));
}
