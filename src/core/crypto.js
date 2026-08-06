// طبقة التشفير — Zero Knowledge
// كل شيء يُشفَّر داخل الجهاز بمفتاح مشتق من عبارة المرور.
// عبارة المرور لا تُخزَّن أبدًا، ولا تُرسل إلى أي مكان.

const PBKDF2_ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

export function fromB64(b64) {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

/** يشتق مفتاح AES-GCM من عبارة المرور باستخدام PBKDF2-SHA256 */
export async function deriveKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** يشفّر أي كائن JSON → { iv, ct } بصيغة base64 */
export async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const data = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: toB64(iv), ct: toB64(ct) };
}

/** يفك التشفير — يرمي استثناءً إذا كان المفتاح خاطئًا (مصادقة GCM) */
export async function decryptJSON(key, blob) {
  const iv = fromB64(blob.iv);
  const ct = fromB64(blob.ct);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(plain));
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
