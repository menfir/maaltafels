const V = 'maaltafels';
// Netwerk eerst, cache als vangnet: nieuwe versies komen vanzelf binnen,
// zonder wifi werkt de app gewoon verder. ponytail: geen versienummer om te bumpen.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V)
    .then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.png']))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
