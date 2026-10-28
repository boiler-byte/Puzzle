/* Puzzle PWA Service Worker */
const SHELL_CACHE   = 'puzzle-shell-v2';
const RUNTIME_CACHE = 'puzzle-runtime-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  './img/bild1.webp',
  './img/bild2.webp',
  './img/bg.webp'
];

/* ---------- Install: App-Shell cachen ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Einzeln hinzufügen, damit ein fehlendes File nicht alles blockiert
      await Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

/* ---------- Activate: alte Caches aufräumen ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ---------- Fetch-Strategie ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // keine fremden Origins cachen

  // Navigationen: erst Netzwerk, dann App-Shell-Fallback (für Offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Alles andere: Cache-First, bei Fehlschlag ins Netzwerk + Runtime-Cache
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && (
          req.destination === 'image' ||
          /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(url.pathname)
        )) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});