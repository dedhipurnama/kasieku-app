/**
 * KASIEKU — SERVICE WORKER
 * Caching untuk PWA offline support
 */

const CACHE_NAME = 'kasieku-v1';

// File yang di-cache untuk offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/components.css',
  '/css/pages.css',
  '/js/config.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/state.js',
  '/js/utils.js',
  '/js/pos.js',
  '/js/products.js',
  '/js/modules.js',
  '/js/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/lucide/0.383.0/umd/lucide.min.js',
];

// Install: cache semua static asset
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
    }).catch(err => console.warn('[SW] Cache install error:', err))
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Fetch: Cache-first untuk static, Network-first untuk API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip API calls (GAS) - selalu network
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, message: 'Offline: tidak ada koneksi internet' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first untuk asset statis
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
