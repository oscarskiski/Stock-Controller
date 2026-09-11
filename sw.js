/* Yard Stock — service worker
   Caches the app shell so it opens instantly and still launches
   with no signal. Stock data itself is NOT cached here (db.js
   handles that in IndexedDB) so you never see a stale count
   presented as if it were live.

   ASSET_V must match the ?v= stamp on the tags in index.html. Bump both
   on every deploy: without it GitHub Pages' own cache headers keep handing
   the browser yesterday's app.js for up to ten minutes after a push. */
const ASSET_V = '11';
const SHELL = 'yardstock-shell-v' + ASSET_V;
const FILES = [
  'index.html',
  'styles.css?v=' + ASSET_V,
  'config.js?v=' + ASSET_V,
  'db.js?v=' + ASSET_V,
  'qr.js?v=' + ASSET_V,
  'app.js?v=' + ASSET_V,
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept API or photo traffic — those must hit the network.
  if (url.origin !== self.location.origin) return;

  // index.html carries the ?v= stamps that point at the current app files,
  // so it must be revalidated against the server. Everything else is stamped
  // and therefore safe to take straight from the browser cache.
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  const hit = isDoc ? fetch(url.href, { cache: 'no-cache' }) : fetch(req);

  // Network-first for the app files so a redeploy is picked up,
  // falling back to cache when there is no signal.
  e.respondWith(
    hit
      .then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
