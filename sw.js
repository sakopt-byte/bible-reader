const CACHE_NAME = 'bible-rst-pwa-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './bible.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// bible.json (~10 МБ) — строго из кэша (cache-first): не качаем заново при каждом запуске.
// Остальные файлы — stale-while-revalidate: открываются мгновенно из кэша и офлайн,
// а при наличии интернета тихо обновляются в фоне (новая версия приложения подхватится при следующем запуске).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    const isBible = url.pathname.endsWith('/bible.json');

    if (isBible && cached) return cached;

    const network = fetch(req).then((resp) => {
      if (resp && resp.status === 200 && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    }).catch(() => null);

    if (cached) { event.waitUntil(network); return cached; }

    const resp = await network;
    if (resp) return resp;
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Нет сети и нет в кэше', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
