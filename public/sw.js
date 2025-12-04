// Chaguo Service Worker
// Version: 1.0.0

const CACHE_NAME = 'chaguo-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/qr-generator.js',
  '/pwa-manager.js',
  '/config-distributor.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Config cache
const CONFIG_CACHE = 'chaguo-configs-v1';
const CONFIG_URLS = [
  'https://raw.githubusercontent.com/cephasgm/chaguo-tanzania/main/configs/latest.json',
  'https://cdn.jsdelivr.net/gh/cephasgm/chaguo-tanzania@main/configs/latest.json'
];

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Install completed');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== CONFIG_CACHE) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activate completed');
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle config requests
  if (CONFIG_URLS.some(configUrl => url.href.includes(configUrl))) {
    event.respondWith(handleConfigRequest(event.request));
    return;
  }
  
  // Handle app requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        
        // Otherwise fetch from network
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Cache successful responses (except for configs)
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
            }
            return response;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed', error);
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html') || 
                     new Response('You are offline. Please check your internet connection.');
            }
            return new Response('Network error', { status: 408 });
          });
      })
  );
});

// Handle config requests with cache-first strategy
async function handleConfigRequest(request) {
  const cache = await caches.open(CONFIG_CACHE);
  
  try {
    // Try cache first
    const cachedResponse = await cache.match(request);
    const now = Date.now();
    
    if (cachedResponse) {
      const cachedData = await cachedResponse.clone().json();
      const cacheAge = now - (cachedData._cachedAt || 0);
      
      // If cache is less than 1 hour old, use it
      if (cacheAge < 60 * 60 * 1000) {
        console.log('Service Worker: Using cached config (age:', cacheAge, 'ms)');
        return cachedResponse;
      }
    }
    
    // Fetch fresh config
    console.log('Service Worker: Fetching fresh config');
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      const data = await responseClone.json();
      
      // Add cache metadata
      data._cachedAt = now;
      data._cachedBy = 'service-worker';
      
      // Store in cache
      const cacheResponse = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      await cache.put(request, cacheResponse);
      
      // Return original response
      return networkResponse;
    }
    
    // If network fails, return cached response if available
    if (cachedResponse) {
      console.log('Service Worker: Network failed, using stale cache');
      return cachedResponse;
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Service Worker: Config fetch error', error);
    
    // Return cached response if available
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to fetch config', offline: true }),
      {
        status: 408,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Background sync for config updates
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync event', event.tag);
  
  if (event.tag === 'sync-configs') {
    event.waitUntil(syncConfigs());
  }
});

// Periodic sync for updates
self.addEventListener('periodicsync', event => {
  console.log('Service Worker: Periodic sync event', event.tag);
  
  if (event.tag === 'update-configs') {
    event.waitUntil(updateConfigs());
  }
});

// Sync configs in background
async function syncConfigs() {
  console.log('Service Worker: Syncing configs in background');
  
  const cache = await caches.open(CONFIG_CACHE);
  
  for (const url of CONFIG_URLS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        data._cachedAt = Date.now();
        data._syncedAt = Date.now();
        
        const cacheResponse = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
        
        await cache.put(url, cacheResponse);
        console.log('Service Worker: Synced config from', url);
      }
    } catch (error) {
      console.error('Service Worker: Failed to sync config from', url, error);
    }
  }
  
  // Notify clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'configs-synced',
      timestamp: Date.now()
    });
  });
}

// Update configs periodically
async function updateConfigs() {
  console.log('Service Worker: Periodic config update');
  await syncConfigs();
}

// Push notifications
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'New update available from Chaguo',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Chaguo Tanzania',
      options
    )
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else if (event.action === 'dismiss') {
    // Notification dismissed
  } else {
    // Default action
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Message handling
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data.type === 'get-config') {
    event.ports[0].postMessage({
      type: 'config-response',
      data: { cached: true }
    });
  }
  
  if (event.data.type === 'clear-cache') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ type: 'cache-cleared' });
    });
  }
});
