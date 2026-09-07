/* Yard Stock — service worker
   Caches the app shell so it opens instantly and still launches
   with no signal. Stock data itself is NOT cached here (db.js
   handles that in IndexedDB) so you never see a stale count
   presented as if it were live. */
const SHELL = 'yardstock-shell-v3';
const FILES = [
  'index.html',
  'styles.css',
  'config.js',
  'db.js',
  'qr.js',
  'app.js',
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

  // Network-first for the app files so a redeploy is picked up,
  // falling back to cache when there is no signal.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
