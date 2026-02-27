// ── ColdChain Service Worker ──────────────────────────────────────────────
// Handles offline caching so the app works without internet access.
// Version this string any time you update the app to force a cache refresh.
const CACHE_NAME = 'coldchain-v1';

// These are the files the app needs to work offline.
// Since ColdChain is a single HTML file + fonts, we cache what we can.
const PRECACHE_URLS = [
  './',
  './frozen-inventory.html',
  './manifest.json',
];

// External resources to cache on first use (fonts from Google)
const FONT_CACHE_NAME = 'coldchain-fonts-v1';

// ── Install: precache app shell ───────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing ColdChain Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching app shell');
        // Use individual adds so one failure doesn't block the rest
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Could not precache:', url, err);
          }))
        );
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating ColdChain Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== FONT_CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Take control of all open tabs
  );
});

// ── Fetch: serve from cache, fall back to network ─────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, etc.)
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // ── Google Fonts: cache-first (fonts rarely change) ──────────────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // ── App files: network-first with cache fallback ──────────────────────
  // Try network first so updates are picked up, fall back to cache offline
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses for same-origin requests
        if (response.ok && url.origin === self.location.origin) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(request).then(cached => {
          if (cached) {
            console.log('[SW] Serving from cache (offline):', request.url);
            return cached;
          }
          // If the request is a navigation (page load), serve the main HTML
          if (request.mode === 'navigate') {
            return caches.match('./frozen-inventory.html');
          }
          // Nothing available
          return new Response('Offline — resource not cached', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// ── Background Sync (future hook for Supabase queue) ─────────────────────
// When you add Supabase later, offline movements can be queued here
// and this event fires when connectivity is restored.
self.addEventListener('sync', event => {
  if (event.tag === 'sync-inventory') {
    console.log('[SW] Background sync triggered: sync-inventory');
    // Future: flush offline movement queue to Supabase
  }
});

// ── Push Notifications (future hook) ─────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'ColdChain Alert';
  const options = {
    body: data.body || 'Inventory alert',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'coldchain-alert',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === event.notification.data && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data);
    })
  );
});
