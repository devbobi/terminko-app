// Terminko PWA service worker.
//
// Stran (HTML) gre VEDNO najprej na omrezje, da posodobitev nikoli ne obtici
// v predpomnilniku. Cache je zanjo samo rezerva za offline. Staticne datoteke
// (ikone, manifest) so cache-first, ker se skoraj ne spreminjajo.
// API na tujem originu (ORDS) se ne predpomni nikoli.
const CACHE = "terminko-v8";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  // kloniraj takoj, sicer je telo lahko ze porabljeno, ko se caches.open razresi
  const copy = response.clone();
  caches.open(CACHE).then(c => c.put(request, copy));
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Tuj origin (ORDS API na Oracle ADB) in APK: vedno omrezje, brez cache
  if (url.origin !== self.location.origin || url.pathname.endsWith(".apk")) return;

  const isPage = e.request.mode === "navigate" ||
                 url.pathname.endsWith("/") ||
                 url.pathname.endsWith("index.html");

  if (isPage) {
    // Network-first: nova razlicica se pokaze takoj, brez cakanja na naslednji obisk
    e.respondWith(
      fetch(e.request)
        .then(r => { if (r.ok) cachePut(e.request, r); return r; })
        .catch(() => caches.match(e.request).then(c => c || caches.match("index.html")))
    );
    return;
  }

  // Staticne datoteke: cache-first z osvezitvijo v ozadju
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request)
        .then(r => { if (r.ok) cachePut(e.request, r); return r; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
