// Service Worker for Routing Station Pro - Offline Caching
const CACHE_NAME = 'routing-station-v1';
const DATA_CACHE = 'routing-data-v1';

// Core app shell files
const APP_SHELL = [
    '/',
    '/index.html',
    '/roles.json',
    '/routes.json'
];

// CDN resources to cache
const CDN_RESOURCES = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: Cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(APP_SHELL).catch(err => {
                console.warn('[SW] Some app shell files failed to cache:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME && key !== DATA_CACHE) {
                    console.log('[SW] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Fetch: Network-first for data, Cache-first for CDN
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Data JSON files: Network-first, fall back to cache
    if (url.pathname.endsWith('.json')) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.status === 200 && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(DATA_CACHE).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // CDN resources: Cache-first (they rarely change)
    if (CDN_RESOURCES.some(cdn => event.request.url.startsWith(cdn.split('/').slice(0, 3).join('/')))) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.status === 200 && event.request.method === 'GET') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Everything else: Network-first
    event.respondWith(
        fetch(event.request).then((response) => {
            if (response.status === 200 && event.request.method === 'GET') {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
        }).catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            // Return a dummy offline response if both network and cache fail
            return new Response("Offline / Resource Unavailable", {
                status: 503,
                statusText: "Service Unavailable",
                headers: new Headers({ "Content-Type": "text/plain" })
            });
        })
    );
});
