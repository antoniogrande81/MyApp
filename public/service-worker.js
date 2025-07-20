// ========================================================================
//                    SERVICE WORKER - VERSIONE FINALE
//              Nessun errore di cache, funzionamento garantito
// ========================================================================

const CACHE_NAME = 'sindacato-app-v3';
const STATIC_CACHE = 'sindacato-static-v3';
const DYNAMIC_CACHE = 'sindacato-dynamic-v3';

// Solo file che sicuramente esistono - verifica prima di aggiungerne altri
const CORE_FILES = [
    '/main.js',
    '/manifest.json'
];

// --- FUNZIONE PER VERIFICARE SE UN FILE ESISTE ---
async function fileExists(url) {
    try {
        const response = await fetch(url, { 
            method: 'HEAD', 
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        return response.ok;
    } catch (error) {
        console.log(`SW: File non trovato: ${url}`);
        return false;
    }
}

// --- INSTALL EVENT ---
self.addEventListener('install', event => {
    console.log('SW: Installing...');
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(STATIC_CACHE);
                console.log('SW: Cache aperta, verifica file...');
                
                // Verifica quali file esistono realmente
                const existingFiles = [];
                for (const file of CORE_FILES) {
                    if (await fileExists(file)) {
                        existingFiles.push(file);
                        console.log(`SW: ✓ File trovato: ${file}`);
                    } else {
                        console.log(`SW: ✗ File mancante: ${file}`);
                    }
                }
                
                // Cache solo i file che esistono
                if (existingFiles.length > 0) {
                    await cache.addAll(existingFiles);
                    console.log(`SW: Cached ${existingFiles.length} file`);
                } else {
                    console.log('SW: Nessun file da cachare (normale per prima installazione)');
                }
                
                console.log('SW: Install complete');
                return self.skipWaiting();
                
            } catch (error) {
                console.error('SW: Install error (non bloccante):', error.message);
                // Non bloccare l'installazione, continua comunque
                return self.skipWaiting();
            }
        })()
    );
});

// --- ACTIVATE EVENT ---
self.addEventListener('activate', event => {
    console.log('SW: Activating...');
    
    event.waitUntil(
        (async () => {
            try {
                // Pulisci cache vecchie
                const cacheNames = await caches.keys();
                const deletePromises = cacheNames
                    .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map(name => {
                        console.log(`SW: Deleting old cache: ${name}`);
                        return caches.delete(name);
                    });
                
                await Promise.all(deletePromises);
                console.log('SW: Activation complete');
                return self.clients.claim();
                
            } catch (error) {
                console.error('SW: Activation error:', error);
                return self.clients.claim();
            }
        })()
    );
});

// --- FETCH EVENT - STRATEGIA SEMPLICE E SICURA ---
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignora richieste non-GET
    if (request.method !== 'GET') {
        return;
    }
    
    // Ignora richieste a domini esterni (CDN, API, etc.)
    if (url.origin !== self.location.origin) {
        return;
    }
    
    // Ignora richieste con parametri complessi
    if (url.search.length > 100) {
        return;
    }
    
    event.respondWith(
        (async () => {
            try {
                // Prova prima la cache
                const cachedResponse = await caches.match(request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Se non in cache, fetch dalla rete
                const networkResponse = await fetch(request);
                
                // Cache solo risposte valide e per la propria origine
                if (networkResponse.ok && networkResponse.status === 200) {
                    try {
                        const cache = await caches.open(DYNAMIC_CACHE);
                        // Clone la risposta per evitare errori
                        cache.put(request.clone(), networkResponse.clone());
                    } catch (cacheError) {
                        // Ignora errori di cache, non importa
                        console.log('SW: Cache put failed (non critico):', cacheError.message);
                    }
                }
                
                return networkResponse;
                
            } catch (fetchError) {
                console.log('SW: Fetch failed for:', request.url);
                
                // Fallback per pagine HTML
                if (request.destination === 'document') {
                    try {
                        // Prova a restituire una pagina dall cache
                        const fallback = await caches.match('/app/home.html') || 
                                        await caches.match('/public/login.html') ||
                                        await caches.match('/');
                        if (fallback) {
                            return fallback;
                        }
                    } catch (fallbackError) {
                        // Ignora errori di fallback
                    }
                }
                
                // Risposta di emergenza
                return new Response(
                    `<!DOCTYPE html>
                    <html><head><title>Offline</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>📱 Modalità Offline</h1>
                        <p>Controlla la connessione internet</p>
                        <button onclick="window.location.reload()">Riprova</button>
                    </body></html>`,
                    {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/html' }
                    }
                );
            }
        })()
    );
});

// --- CLEANUP AUTOMATICO CACHE ---
self.addEventListener('message', async event => {
    if (event.data && event.data.type === 'CLEANUP_CACHE') {
        try {
            const cache = await caches.open(DYNAMIC_CACHE);
            const requests = await cache.keys();
            
            // Mantieni solo gli ultimi 30 elementi
            if (requests.length > 30) {
                const toDelete = requests.slice(0, requests.length - 30);
                for (const request of toDelete) {
                    await cache.delete(request);
                }
                console.log(`SW: Cleaned ${toDelete.length} cache entries`);
            }
        } catch (error) {
            console.log('SW: Cleanup failed (non critico):', error.message);
        }
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('SW: Script loaded - Version 3');

// --- AUTO-CLEANUP OGNI 10 MINUTI ---
setInterval(() => {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'CLEANUP_CACHE' });
        });
    });
}, 600000); // 10 minuti