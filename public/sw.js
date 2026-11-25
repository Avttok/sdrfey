/* Guarda só arquivos estáticos (JS/CSS/fontes/imagens). Páginas e dados NUNCA entram aqui.
   Arquivos versionados (/_next/static, /vendor): direto do aparelho, sem rede. Imagens soltas: mostra a guardada e atualiza por trás. */
const CACHE = "sdrfey-static-v3";
const MAX = 400;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
const trim = async (c) => { const ks = await c.keys(); if (ks.length > MAX) await Promise.all(ks.slice(0, ks.length - MAX).map((k) => c.delete(k))); };
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  const fixed = u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/vendor/");
  if (!(fixed || /\.(woff2?|png|jpg|jpeg|svg|ico|webp|avif)$/.test(u.pathname))) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(r);
    const net = () => fetch(r).then((res) => { if (res.ok) { c.put(r, res.clone()); trim(c); } return res; });
    if (hit) { if (!fixed) e.waitUntil(net().catch(() => {})); return hit; }
    return net();
  }));
});
