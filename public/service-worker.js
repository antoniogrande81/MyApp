// Aumenta la versione ogni volta che modifichi questo file per forzare l'aggiornamento
const CACHE_NAME = 'myapp-cc-cache-v3'; 

// Lista completa e corretta dei file da mettere in cache
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/logout.html',
  '/admin.html',
  '/home.html', // Aggiunto per coerenza
  '/app/tessera.html',
  '/app/profilo.html',
  '/app/dirigenti.html',
  '/app/dirigente-dashboard.html',
  '/scripts/main.js',
  '/css/style.css', // Aggiunto file CSS
  '/manifest.json'
  // Aggiungi qui altre risorse importanti (es. /images/logo.png)
];

// Evento di installazione: pre-carica le risorse dell'app
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aperta e file aggiunti.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Errore durante il caching dei file:', error);
      })
  );
});

// Evento di attivazione: pulisce le vecchie cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Rimozione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Evento Fetch: serve i file dalla cache (strategia Cache-First)
self.addEventListener('fetch', event => {
  // Rispondi solo alle richieste della stessa origine (non alle API esterne)
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // Se la risorsa è nella cache, restituiscila
        if (cachedResponse) {
          return cachedResponse;
        }
        // Altrimenti, scaricala dalla rete
        return fetch(event.request);
      })
    );
  }
});