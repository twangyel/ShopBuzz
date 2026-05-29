/*
  Buzz Cafe Service Worker
  Strategy: Cache-First for static assets, Network-First for dynamic/API
  Version: 1.0.0
*/

const CACHE_NAME = 'buzz-cafe-v1';
const STATIC_CACHE = 'buzz-cafe-static-v1';
const IMAGE_CACHE = 'buzz-cafe-images-v1';
const DYNAMIC_CACHE = 'buzz-cafe-dynamic-v1';

// Core assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/menu.html',
  '/order.html',
  '/track.html',
  '/assets/css/index.css',
  '/assets/js/index.js',
  '/manifest.json',
  '/offline.html'
];

// External assets that should be cached
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: Pre-cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Buzz Cafe Service Worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Cache external assets separately
        return caches.open(STATIC_CACHE).then((cache) => {
          return Promise.all(
            EXTERNAL_ASSETS.map(url => 
              fetch(url, { mode: 'no-cors' })
                .then(response => cache.put(url, response))
                .catch(err => console.log('[SW] Failed to cache external:', url, err))
            )
          );
        });
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('buzz-cafe-') && 
                   name !== STATIC_CACHE && 
                   name !== IMAGE_CACHE && 
                   name !== DYNAMIC_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch: Intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls (let them go network-only)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Strategy 1: Cache-First for static assets (CSS, JS, HTML)
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy 2: Cache-First for images with background refresh
  if (isImage(request)) {
    event.respondWith(imageStrategy(request));
    return;
  }

  // Strategy 3: Network-First for dynamic content
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Helper: Check if request is a static asset
function isStaticAsset(request) {
  const dest = request.destination;
  return dest === 'script' || dest === 'style' || dest === 'document' || 
         request.url.endsWith('.json') || request.url.endsWith('.html');
}

// Helper: Check if request is an image
function isImage(request) {
  return request.destination === 'image' || 
         /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(request.url);
}

// Cache-First Strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Background refresh: update cache in background
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response);
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    // If it's a document request and network fails, show offline page
    if (request.mode === 'navigate') {
      return cache.match('/offline.html');
    }
    throw error;
  }
}

// Image Strategy: Cache-First with size-limited cache
async function imageStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Limit image cache size (keep only last 50 images)
      const keys = await cache.keys();
      if (keys.length > 50) {
        await cache.delete(keys[0]);
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return a fallback SVG for broken images
    if (request.destination === 'image') {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
          <rect width="400" height="300" fill="#FAF7F0"/>
          <text x="200" y="150" text-anchor="middle" font-family="serif" font-size="18" fill="#8B7348">☕ Image unavailable offline</text>
        </svg>`,
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    throw error;
  }
}

// Network-First Strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      return cache.match('/offline.html');
    }
    throw error;
  }
}

// Background Sync for form submissions (if user goes offline while submitting)
self.addEventListener('sync', (event) => {
  if (event.tag === 'review-sync') {
    event.waitUntil(syncReviews());
  }
});

async function syncReviews() {
  // Placeholder for background sync logic
  // You can store failed submissions in IndexedDB and retry here
  console.log('[SW] Background sync triggered for reviews');
}

// Push notifications support (ready for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Your order is ready!',
    icon: '/image/logo-192.png',
    badge: '/image/logo-192.png',
    tag: data.tag || 'buzz-cafe',
    requireInteraction: true,
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Buzz Cafe', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});