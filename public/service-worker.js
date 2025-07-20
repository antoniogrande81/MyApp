// ========================================================================
//                    SERVICE WORKER - VERSIONE CORRETTA
//              Gestione PWA con cache migliorata e error handling
// ========================================================================

const CACHE_NAME = 'sindacato-app-v1.2';
const CACHE_STATIC_NAME = 'sindacato-static-v1.2';
const CACHE_DYNAMIC_NAME = 'sindacato-dynamic-v1.2';

// File statici da cachare (solo quelli che esistono realmente)
const STATIC_FILES = [
    '/',
    '/app/',
    '/app/home.html',
    '/app/tessera.html',
    '/app/profilo.html',
    '/app/dirigenti.html',
    '/app/dirigente-dashboard.html',
    '/public/login.html',
    '/public/register.html',
    '/main.js',
    '/manifest.json',
    // Aggiungi qui solo i file CSS/JS che esistono realmente
    // Non includere CDN esterni che potrebbero causare errori CORS
];

// URL esterni che NON devono essere cachati
const EXTERNAL_URLS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net',
    'https://api.qrserver.com',
    'https://ui-avatars.com',
    'https://lycrgzptkdkksukcwrld.supabase.co'
];

// Controlla se un URL è esterno
const isExternalUrl = (url) => {
    return EXTERNAL_URLs.some(external => url.startsWith(external));
};

// Controlla se un file esiste prima di aggiungerlo alla cache
const fileExists = async (url) => {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
};

// --- EVENTO INSTALL ---
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_STATIC_NAME);
                console.log('✅ Service Worker: Cache aperta.');
                
                // Filtra solo i file che esistono realmente
                const existingFiles = [];
                for (const file of STATIC_FILES) {
                    if (await fileExists(file)) {
                        existingFiles.push(file);
                    } else {
                        console.warn(`⚠️ File non trovato, saltato: ${file}`);
                    }
                }
                
                if (existingFiles.length > 0) {
                    await cache.addAll(existingFiles);
                    console.log('✅ Service Worker: File statici aggiunti alla cache:', existingFiles.length);
                } else {
                    console.warn('⚠️ Service Worker: Nessun file statico da cachare');
                }
                
                // Forza l'attivazione del nuovo service worker
                self.skipWaiting();
                
            } catch (error) {
                console.error('❌ Service Worker: Errore durante il caching:', error);
                // Non bloccare l'installazione anche se il caching fallisce
            }
        })()
    );
});

// --- EVENTO ACTIVATE ---
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        (async () => {
            try {
                // Pulisci le cache vecchie
                const cacheNames = await caches.keys();
                const deletePromises = cacheNames
                    .filter(name => name !== CACHE_STATIC_NAME && name !== CACHE_DYNAMIC_NAME)
                    .map(name => {
                        console.log(`🗑️ Eliminando cache vecchia: ${name}`);
                        return caches.delete(name);
                    });
                
                await Promise.all(deletePromises);
                
                // Prendi il controllo di tutte le schede aperte
                await self.clients.claim();
                
                console.log('✅ Service Worker: Attivato e pronto');
            } catch (error) {
                console.error('❌ Service Worker: Errore durante attivazione:', error);
            }
        })()
    );
});

// --- EVENTO FETCH ---
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignora richieste non HTTP/HTTPS
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Strategia Cache-First per file statici
    if (STATIC_FILES.includes(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Network-First per API Supabase e contenuti dinamici
    if (isExternalUrl(request.url)) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Cache-First per tutto il resto
    event.respondWith(cacheFirst(request));
});

// --- STRATEGIA CACHE-FIRST ---
async function cacheFirst(request) {
    try {
        // Cerca prima nella cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Se non in cache, fetch dalla rete
        const networkResponse = await fetch(request);
        
        // Caches la risposta se valida (solo per richieste GET)
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_DYNAMIC_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('❌ Service Worker: Errore Cache-First:', error);
        
        // Fallback per pagine offline
        if (request.destination === 'document') {
            const cache = await caches.open(CACHE_STATIC_NAME);
            return cache.match('/app/home.html') || cache.match('/');
        }
        
        // Risposta di fallback per altri tipi di richiesta
        return new Response('Contenuto non disponibile offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// --- STRATEGIA NETWORK-FIRST ---
async function networkFirst(request) {
    try {
        // Prova prima la rete
        const networkResponse = await fetch(request);
        
        // Cache la risposta se valida
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_DYNAMIC_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.warn('⚠️ Service Worker: Network failed, trying cache:', request.url);
        
        // Fallback alla cache se la rete fallisce
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Risposta di fallback
        return new Response('Risorsa non disponibile offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// --- GESTIONE MESSAGGI ---
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// --- CLEANUP PERIODICO CACHE ---
self.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'CLEANUP_CACHE') {
        try {
            const cache = await caches.open(CACHE_DYNAMIC_NAME);
            const requests = await cache.keys();
            
            // Mantieni solo gli ultimi 50 elementi nella cache dinamica
            if (requests.length > 50) {
                const toDelete = requests.slice(0, requests.length - 50);
                await Promise.all(toDelete.map(request => cache.delete(request)));
                console.log(`🗑️ Rimossi ${toDelete.length} elementi dalla cache dinamica`);
            }
        } catch (error) {
            console.error('❌ Errore cleanup cache:', error);
        }
    }
});

console.log('📦 Service Worker: Script caricato');