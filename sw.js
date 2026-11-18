/* Yohoho x ブロスタ — Service Worker
   ゲームのファイルをブラウザにキャッシュして、オフラインでも開けるようにする。
   新しい版を出したときは CACHE_NAME の数字（v1 → v2…）を上げると、古いキャッシュが消えて新しい版に置き換わる。 */
const CACHE_NAME = 'yohoho-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/lobby.css',
  './css/rooms.css',
  './css/gacha.css',
  './css/game.css',
  './js/data.js',
  './js/lobby.js',
  './js/gacha.js',
  './js/game.js',
  './js/input.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* まずキャッシュ、なければネット。ネットから取れたらキャッシュにも入れる。 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
