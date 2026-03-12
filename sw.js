const CACHE_NAME = 'rsp-safe-cache-v1';

// Service Worker Registration
self.addEventListener('install', (event) => {
    // Force the waiting service worker to become the active service worker.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Delete any old caches to ensure a clean slate
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    // Tell the active service worker to take control of the page immediately.
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. STRICT BYPASS RULES
    // NEVER cache Supabase API calls, Google Auth requests, or Map Tiles.
    // This is the #1 reason previous Service Workers broke the app.
    if (
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('google.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('googleusercontent.com') ||
        url.hostname.includes('openstreetmap.org') || // Map tiles
        url.hostname.includes('basemaps.cartocdn.com') // Map tiles
    ) {
        return; // Let the browser handle it completely natively = 100% safe
    }

    // 2. NETWORK-FIRST STRATEGY for everything else (HTML, JS, CSS)
    // Always try to fetch from the network first to guarantee users get updates.
    // Only fallback to the cache if the network fails completely (offline).
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If it's a valid response, cache it for later offline use
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed (offline). Try to find it in the cache.
                return caches.match(event.request);
            })
    );
});
