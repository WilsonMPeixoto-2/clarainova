/// <reference lib="webworker" />

const CACHE_NAME = 'clara-v1';
const STATIC_CACHE_NAME = 'clara-static-v1';
const DYNAMIC_CACHE_NAME = 'clara-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/og-image.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API calls and Supabase requests - always go to network
  if (url.pathname.includes('/functions/') || 
      url.pathname.includes('/rest/') ||
      url.pathname.includes('/auth/') ||
      url.hostname.includes('supabase')) {
    return;
  }

  // For HTML pages - network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the response
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Ultimate fallback - return cached index.html
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For static assets - cache first, fallback to network
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in background
          fetch(request).then((networkResponse) => {
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }).catch(() => {});
          return cachedResponse;
        }
        
        // Not in cache - fetch from network
        return fetch(request).then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default - network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline queries (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queries') {
    console.log('[SW] Syncing offline queries');
    // Future: sync saved queries when back online
  }
});
