"use client";

import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Quando o Adm abre a tela da pessoa em “Ao vivo”, a cada 3 s esta aba envia uma foto pequena e comprimida
 * do que está na tela (campos de senha ficam de fora). Fora disso só pergunta, de 20 em 20 s, se alguém está olhando.
 */
export function LiveSnap() {
  const path = usePathname();
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let alive = true, busy = false, fast: ReturnType<typeof setInterval> | null = null;
    const stopFast = () => { if (fast) clearInterval(fast); fast = null; setSharing(false); };
    const shoot = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const { toJpeg } = await import("html-to-image");
        const image = await toJpeg(document.body, { quality: 0.4, pixelRatio: 0.5, cacheBust: false, skipFonts: true, filter: (n) => !(n instanceof HTMLInputElement && n.type === "password") && !(n instanceof HTMLElement && n.dataset.noSnap !== undefined) });
        const r = await fetch("/api/live/snap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, path }) });
        const j = (await r.json()) as { keep?: boolean };
        if (!j.keep && alive) stopFast();
      } catch { /* foto falhou: tenta de novo no próximo ciclo */ } finally { busy = false; }
    };
    const ask = async () => {
      if (fast || document.visibilityState !== "visible") return;
      try {
        const j = (await (await fetch("/api/live/want", { cache: "no-store" })).json()) as { watch?: boolean };
        if (j.watch && alive && !fast) { setSharing(true); void shoot(); fast = setInterval(shoot, 3000); }
      } catch { /* sem rede: ignora */ }
    };
    void ask();
    const t = setInterval(ask, 20_000);
    return () => { alive = false; clearInterval(t); stopFast(); };
  }, [path]);
  if (!sharing) return null;
  return <span className="fixed bottom-3 left-3 z-[60] inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium text-bg shadow" role="status"><Eye size={12} aria-hidden /> Tela visível para a gestão</span>;
}
