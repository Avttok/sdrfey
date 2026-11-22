/* Guarda só arquivos estáticos (JS/CSS/fontes/imagens com nome versionado). Páginas e dados NUNCA entram aqui. */
const CACHE = "sdrfey-static-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (!(u.pathname.startsWith("/_next/static/") || /\.(woff2?|png|jpg|jpeg|svg|ico|webp|avif)$/.test(u.pathname))) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(r);
    if (hit) return hit;
    const res = await fetch(r);
    if (res.ok) c.put(r, res.clone());
    return res;
  }));
});
