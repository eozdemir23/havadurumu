const CACHE_NAME = 'weatheros-v3.1';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js', // Kendi js dosyanın adı neyse onu yaz
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
