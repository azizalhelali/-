// عامل الخدمة — يجعل التطبيق يعمل بلا اتصال.
// لا يخزّن أي بيانات مستخدم: البيانات كلها في IndexedDB المشفّرة.
// طلبات api.anthropic.com تمرّ مباشرةً للشبكة ولا تُخزَّن إطلاقًا.

const CACHE = 'pbos-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './src/styles.css',
  './src/core/crypto.js',
  './src/core/db.js',
  './src/core/util.js',
  './src/core/vault.js',
  './src/core/store.js',
  './src/ai/provider.js',
  './src/ai/agents.js',
  './src/ai/council.js',
  './src/ui/ui.js',
  './src/ui/app.js',
  './src/ui/views/collection.js',
  './src/ui/views/modules.js',
  './src/ui/views/executive.js',
  './src/ui/views/finance.js',
  './src/ui/views/board.js',
  './src/ui/views/security.js',
  './src/ui/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // لا نتدخّل إطلاقًا في نداءات النموذج
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  // الشبكة أولًا ثم الكاش — لتصل التحديثات فورًا مع بقاء العمل بلا اتصال
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
