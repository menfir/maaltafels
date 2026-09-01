// Netwerk eerst, cache als vangnet. Anders dan bij frans heeft offline hier wel zin:
// maaltafels oefenen is puur rekenen, alleen de microfoon heeft internet nodig.
// Geen vaste lijst om vooraf te cachen — Vite geeft assets een hash in hun naam,
// dus die lijst zou bij elke build verlopen. Wat opgevraagd is, zit in de cache.
const V = 'maaltafels'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const kopie = r.clone()
        caches.open(V).then((c) => c.put(e.request, kopie))
        return r
      })
      // Offline: uit de cache, en voor een navigatie altijd de app-shell.
      .catch(() =>
        caches
          .match(e.request)
          .then((r) => r ?? (e.request.mode === 'navigate' ? caches.match('/maaltafels/') : undefined)),
      ),
  )
})
