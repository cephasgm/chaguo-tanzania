// sw.js - Service Worker for GitHub Pages
const CACHE_NAME = 'chaguo-cache-v1';
const urlsToCache = [
  '/chaguo-tanzania/',
  '/chaguo-tanzania/index.html',
  '/chaguo-tanzania/style.css',
  '/chaguo-tanzania/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
