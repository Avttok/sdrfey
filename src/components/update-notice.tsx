"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Se saiu uma versão nova do site enquanto esta aba estava aberta, pede para recarregar. O Adm liga/desliga em Configurações. */
export function UpdateNotice() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (MINE === "dev") return;
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const j = (await r.json()) as { v?: string; on?: boolean };
        if (!stop) setStale(!!j.on && !!j.v && j.v !== MINE);
      } catch { /* sem rede: tenta depois */ }
    };
    const id = setInterval(check, 90_000);
    const vis = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", vis);
    void check();
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, []);
  if (!stale) return null;
  return (
    <div className="embed-hide fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="upd-t">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-line bg-panel p-6 text-center shadow-2xl">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-grad text-on-accent"><RefreshCw size={26} aria-hidden /></span>
        <div className="space-y-1"><h2 id="upd-t" className="display text-xl">Há uma nova atualização!</h2><p className="text-sm text-muted">Por favor, recarregue a página.</p></div>
        <button type="button" autoFocus onClick={() => location.reload()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-grad text-base font-bold text-on-accent shadow-lg transition hover:brightness-110 active:scale-[0.98]"><RefreshCw size={18} aria-hidden /> Recarregar agora</button>
      </div>
    </div>
  );
}
