/* JARVIS — Service Worker
   Stratégie "network-first" : on sert TOUJOURS la dernière version quand le
   réseau est disponible, et on garde une copie en cache uniquement comme
   secours hors-ligne. Fini les "vieilles versions" coincées en cache. */
const CACHE = 'jarvis-cache-v1';

self.addEventListener('install', () => {
  // Le nouveau worker prend la main immédiatement, sans attendre.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Purge des anciens caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isDoc = req.mode === 'navigate' || req.destination === 'document';

  e.respondWith((async () => {
    try {
      // Pour le document : on force le contournement du cache HTTP → vraie
      // dernière version à chaque ouverture en ligne.
      const fresh = await fetch(req, isDoc ? { cache: 'no-store' } : {});
      // On garde une copie des ressources de même origine pour le hors-ligne.
      try {
        const url = new URL(req.url);
        if (url.origin === self.location.origin && fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
      } catch (_) {}
      return fresh;
    } catch (err) {
      // Hors-ligne : on sert la copie en cache si elle existe.
      const cached = await caches.match(req);
      if (cached) return cached;
      if (isDoc) {
        const fallback = await caches.match('./index.html') || await caches.match('./');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
