const CACHE_NAME = 'fireconnect-image-cache-v1';
const IMAGE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Intercept Supabase Storage requests
    const isSupabaseStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/');

    if (isSupabaseStorage) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        const dateHeader = cachedResponse.headers.get('date');
                        const now = Date.now();
                        const cacheDate = dateHeader ? new Date(dateHeader).getTime() : now;

                        if (now - cacheDate < IMAGE_TTL) {
                            return cachedResponse;
                        }
                    }

                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        return cachedResponse;
                    });
                });
            })
        );
    }
});
