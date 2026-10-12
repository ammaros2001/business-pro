/**
 * Service Worker for Business Pro PWA
 * Enables offline caching, fast loading, and home-screen installability.
 */

const CACHE_NAME = 'biz-pro-cache-v3.8';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/firebase-config.js',
  './js/store.js',
  './js/firebase-service.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon.svg',
  './icons/apple-touch-icon.png'
];

// Install Event: Precaches core app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('Pre-cache partial failure:', err);
      });
    })
  );
});

// Activate Event: Cleans up older caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First with Cache Fallback for dynamic offline usage
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Ignore Firebase Realtime DB and auth endpoints from service worker caching
  if (req.url.includes('firebaseio.com') || req.url.includes('identitytoolkit') || req.url.includes('googleapis.com/identitytoolkit')) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then(networkResponse => {
        // If valid response, clone and update cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when offline or network fails
        return caches.match(req).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          // Fallback to main page for navigation
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
