// Funzionamento offline: i file dell'app restano in cache; i dati sono nel browser.
const CACHE = "diario-dieta-v4";
const FILE = ["./", "index.html", "app.js", "stile.css", "manifest.webmanifest", "icona.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.endsWith("dati-iniziali.json")) return;
  // Prima la rete (per avere sempre l'ultima versione), poi la cache se offline.
  e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
});
