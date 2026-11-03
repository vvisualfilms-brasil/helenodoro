// Service worker: deixa o app abrir sem internet.
// Estratégia "rede primeiro": sempre tenta a versão nova; sem rede, usa o cache.
// Ao publicar mudanças grandes, aumente o número da versão.
const CACHE = 'helenodoro-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/app.js',
  './src/storage.js',
  './src/core/timer.js',
  './src/core/day.js',
  './src/core/stats.js',
  './src/platform/sound.js',
  './src/platform/focus.js',
  './icons/tomato.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./index.html'))),
  );
});
