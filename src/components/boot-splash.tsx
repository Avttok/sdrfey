"use client";

import { useEffect, useRef, useState } from "react";
import { BannerRain } from "@/components/banner-rain";
import { FeyMark } from "@/components/logo";

/** Mesmo nome do cache usado em public/sw.js. */
const CACHE = "sdrfey-static-v2";
type Manifest = { v: string; files: { url: string; size: number }[] };
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Tela de carregamento ao abrir ou recarregar o site: confere o que o navegador já guardou e baixa só o que falta (JS, estilos, fontes, imagens).
 * A barra anda conforme o peso do que precisa ser guardado; com tudo guardado, passa quase direto. Nunca trava o uso: se algo falhar, entra mesmo assim.
 */
export function BootSplash() {
  const [pct, setPct] = useState(0);
  const [info, setInfo] = useState("Conferindo o que já está guardado…");
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [late, setLate] = useState(false);
  const started = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // a chuva sorteia posições: só depois de montar, para não divergir do HTML do servidor

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      const wait = Math.max(0, 900 - (performance.now() - t0)); // dá tempo de ver a tela mesmo quando já está tudo guardado
      setPct(100);
      setTimeout(() => { setLeaving(true); setTimeout(() => setGone(true), 450); }, wait);
    };
    const lateTimer = setTimeout(() => setLate(true), 8000);
    const hard = setTimeout(finish, 25000);
    (async () => {
      try {
        if (process.env.NODE_ENV !== "production") return finish(); // em desenvolvimento não há arquivos fixos para guardar
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js").catch(() => {});
        if (!("caches" in window)) return finish();
        const cache = await caches.open(CACHE);
        let man: Manifest | null = null;
        try { const r = await fetch("/api/precache", { cache: "no-store" }); if (r.ok) man = await r.json(); } catch { /* sem lista: usa só o que a página já pediu */ }
        // sem a lista (ex.: modo de desenvolvimento), guarda o que esta página carregou
        const files = man?.files?.length ? man.files : [...new Set(performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname).filter((p) => p.startsWith("/_next/static/")))].map((url) => ({ url, size: 30000 }));
        const wanted = new Set(files.map((f) => f.url));
        // limpa o que não existe mais (versões antigas do site)
        for (const req of await cache.keys()) { const p = new URL(req.url).pathname; if (p.startsWith("/_next/static/") && !wanted.has(p)) await cache.delete(req); }
        const missing: typeof files = [];
        let have = 0, total = 0;
        for (const f of files) { total += f.size; if (await cache.match(f.url)) have += f.size; else missing.push(f); }
        const need = total - have;
        if (!missing.length) { setInfo(`Tudo pronto · ${files.length} arquivos já guardados`); return finish(); }
        setInfo(`Guardando ${missing.length} arquivo${missing.length === 1 ? "" : "s"} (${kb(need)}) para o site abrir rápido`);
        let got = 0, done = 0, i = 0;
        const worker = async () => {
          while (i < missing.length) {
            const f = missing[i++];
            try { const r = await fetch(f.url, { cache: "reload" }); if (r.ok) await cache.put(f.url, r); } catch { /* tenta de novo na próxima abertura */ }
            got += f.size; done++;
            setPct(Math.min(99, Math.round((got / Math.max(1, need)) * 100)));
            setInfo(`Guardando arquivos · ${done} de ${missing.length}`);
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        finish();
      } catch { finish(); }
    })();
    return () => { clearTimeout(lateTimer); clearTimeout(hard); };
  }, []);

  if (gone) return null;
  return (
    <div id="boot" role="status" aria-live="polite" aria-label="Carregando sistema" className={`fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-bg text-ink transition-opacity duration-500 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <noscript><style>{"#boot{display:none}"}</style></noscript>
      {mounted && <BannerRain roles={["seller", "user"]} count={34} field />}
      <div className="relative z-10 flex w-[min(22rem,86vw)] flex-col items-center gap-6 text-center">
        <span className="text-accent"><FeyMark animated size={120} color="currentColor" /></span>
        <div className="w-full space-y-2.5">
          <p className="display text-xl">Carregando sistema…</p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2.5 w-full overflow-hidden rounded-full bg-line/70">
            <span className="block h-full rounded-full bg-grad transition-[width] duration-300 ease-out" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <p className="figure text-xs text-muted">{pct}% · {info}</p>
          {late && <button type="button" onClick={() => { setLeaving(true); setTimeout(() => setGone(true), 450); }} className="mt-1 text-xs font-semibold text-accent underline">Entrar agora</button>}
        </div>
      </div>
    </div>
  );
}
