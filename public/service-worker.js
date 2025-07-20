// ========================================================================
//                    SERVICE WORKER - VERSIONE PULITA
//              Semplice e funzionale, senza errori
// ========================================================================

const CACHE_NAME = 'sindacato-app-v2';
const STATIC_CACHE = 'sindacato-static-v2';
const DYNAMIC_CACHE = 'sindacato-dynamic-v2';

// File da cachare (solo quelli essenziali)
const STATIC_FILES = [
    '/',
    '/app/',
    '/app/home.html',
    '/app/tessera.html',
    '/app/profilo.html',
    '/app/dirigenti.html',
    '/public/login.html',
    '/main.js'
];

// --- INSTALL EVENT ---
self.addEventListener('install', event => {
    console.log('SW: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('SW: Caching static files...');
                return cache.addAll(STATIC_FILES.map(url => new Request(url, {cache: 'reload'})));
            })
            .catch(error => {
                console.error('SW: Install failed:', error);
                // Non bloccare l'installazione
                return Promise.resolve();
            })
            .then(() => {
                console.log('SW: Install complete');
                return self.skipWaiting();
            })
    );
});

// --- ACTIVATE EVENT ---
self.addEventListener('activate', event => {
    console.log('SW: Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('SW: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('SW: Activation complete');
                return self.clients.claim();
            })
    );
});

// --- FETCH EVENT ---
self.addEventListener('fetch', event => {
    const request = event.request;
    
    // Ignora richieste non-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignora richieste cross-origin complesse
    if (!request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(request)
                    .then(networkResponse => {
                        // Cache solo risposte valide
                        if (networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(request, responseClone);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback per pagine offline
                        if (request.destination === 'document') {
                            return caches.match('/app/home.html');
                        }
                        return new Response('Offline', {status: 503});
                    });
            })
    );
});

console.log('SW: Script loaded');