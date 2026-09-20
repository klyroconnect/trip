// Bingwa service worker — bump CACHE_VERSION whenever you want to force users to refresh cached files.
const CACHE_VERSION = 'bingwa-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs. Leave WhatsApp, fonts, Wikimedia, audio ranges etc. to the browser.
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range')) return;

  // Pages: network first (so updates show up), fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Images, icons, etc.: serve from cache instantly, refresh in the background.
  event.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
