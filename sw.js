const CACHE_NAME = 'bible-rst-pwa-v10';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './bible.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (isHtml) {
    event.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            caches.match('./index.html').then((cached) => resolve(cached || fetch(event.request)));
          }
        }, 3000);

        fetch(event.request)
          .then((resp) => {
            clearTimeout(timer);
            if (resp && resp.status === 200) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
            }
            if (!settled) {
              settled = true;
              resolve(resp);
            }
          })
          .catch(() => {
            clearTimeout(timer);
            if (!settled) {
              settled = true;
              caches.match('./index.html').then((cached) => resolve(cached || new Response('Офлайн: откройте приложение один раз с интернетом.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
            }
          });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});
