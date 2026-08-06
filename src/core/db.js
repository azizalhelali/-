// طبقة التخزين المحلي — IndexedDB
// السجلات تُخزَّن مشفّرة بالكامل. الحقول الظاهرة بلا تشفير هي فقط:
// id (معرّف عشوائي), type (نوع السجل), updatedAt — لأغراض الفهرسة.

const DB_NAME = 'pbos';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_META = 'meta';

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const s = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        s.createIndex('type', 'type', { unique: false });
        s.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'k' });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- meta (غير مشفّر: الملح ومعلومات التحقق فقط) ----
export async function metaGet(k) {
  const s = await tx(STORE_META, 'readonly');
  const r = await wrap(s.get(k));
  return r ? r.v : undefined;
}

export async function metaSet(k, v) {
  const s = await tx(STORE_META, 'readwrite');
  return wrap(s.put({ k, v }));
}

export async function metaDel(k) {
  const s = await tx(STORE_META, 'readwrite');
  return wrap(s.delete(k));
}

// ---- records ----
export async function rawPut(record) {
  const s = await tx(STORE_RECORDS, 'readwrite');
  return wrap(s.put(record));
}

export async function rawGet(id) {
  const s = await tx(STORE_RECORDS, 'readonly');
  return wrap(s.get(id));
}

export async function rawDelete(id) {
  const s = await tx(STORE_RECORDS, 'readwrite');
  return wrap(s.delete(id));
}

export async function rawByType(type) {
  const s = await tx(STORE_RECORDS, 'readonly');
  const idx = s.index('type');
  return wrap(idx.getAll(IDBKeyRange.only(type)));
}

export async function rawAll() {
  const s = await tx(STORE_RECORDS, 'readonly');
  return wrap(s.getAll());
}

export async function rawClearAll() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction([STORE_RECORDS, STORE_META], 'readwrite');
    t.objectStore(STORE_RECORDS).clear();
    t.objectStore(STORE_META).clear();
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
