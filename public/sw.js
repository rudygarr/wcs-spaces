// WCS Spaces service worker — makes the app installable and gives it an offline
// shell. Deliberately network-first so the frequently-redeployed demo never
// serves a stale build; the cache is only a fallback when offline.
const CACHE = 'wcs-spaces-v1';

self.addEventListener('install', (event) => {
  // Cache the app shell so a cold offline launch still boots.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './app-icon.svg', './manifest.webmanifest'])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // SPA navigations (HashRouter) → network first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // Other assets → network first, cache the result, fall back to cache offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
