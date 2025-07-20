const CACHE_NAME = 'myapp-cc-cache-v2'; // Ho incrementato la versione per forzare l'aggiornamento
const urlsToCache = [
  '/',
  '/public/index.html',
  '/public/login.html',
  '/app/tessera.html',
  '/app/profilo.html',
  '/scripts/main.js',
  '/manifest.json'
  // Aggiungi qui altre pagine locali che vuoi che funzionino offline
];

// Evento di installazione: pre-carica le risorse dell'app
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
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
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Evento Fetch: decide come rispondere alle richieste
self.addEventListener('fetch', event => {
  // Strategia: Cache-First solo per le richieste locali (stessa origine)
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Restituisce dalla cache se presente
        }
        return fetch(event.request); // Altrimenti, scarica dalla rete
      })
    );
  }
  // Per le richieste esterne (es. API, immagini placeholder), lascia che il browser le gestisca
});