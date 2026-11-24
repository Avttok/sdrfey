"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Hit = { el: HTMLElement; left: number; right: number; top: number; bottom: number; l: boolean; r: boolean };

/** Tudo que pode rolar para o lado: faixas, abas e as caixas que envolvem tabelas. */
const SEL = '[class*="overflow-x-auto"],[class*="overflow-x-scroll"],[class*="overflow-auto"],[data-hscroll]';

/**
 * Setas de rolagem para o lado em TODAS as filas de botões e planilhas do sistema.
 * Procura sozinho qualquer caixa que tenha mais conteúdo do que cabe na largura e põe setas nas pontas (só enquanto há o que rolar).
 * Tabelas largas sem caixa própria ganham rolagem automática. Quem já tem setas próprias (HScroll) marca `data-no-scroll-assist`.
 */
export function ScrollAssist() {
  const [hits, setHits] = useState<Hit[]>([]);
  const tracked = useRef<Set<HTMLElement>>(new Set());
  const raf = useRef(0);

  useEffect(() => {
    const measure = () => {
      raf.current = 0;
      const out: Hit[] = [];
      const vh = window.innerHeight;
      for (const el of tracked.current) {
        if (!el.isConnected) { tracked.current.delete(el); continue; }
        const max = el.scrollWidth - el.clientWidth;
        if (max < 6) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 120) continue;
        const top = Math.max(r.top, 72), bottom = Math.min(r.bottom, vh);
        if (bottom - top < 44 || r.right < 0 || r.left > window.innerWidth) continue;
        out.push({ el, left: Math.max(r.left, 0), right: Math.min(r.right, window.innerWidth), top, bottom, l: el.scrollLeft > 4, r: el.scrollLeft < max - 4 });
      }
      setHits((prev) => (prev.length === out.length && prev.every((p, i) => p.el === out[i].el && p.left === out[i].left && p.right === out[i].right && p.top === out[i].top && p.bottom === out[i].bottom && p.l === out[i].l && p.r === out[i].r) ? prev : out));
    };
    const schedule = () => { if (!raf.current) raf.current = requestAnimationFrame(measure); };
    const scan = () => {
      // tabela mais larga que a caixa onde está: a caixa passa a rolar
      document.querySelectorAll<HTMLTableElement>("table").forEach((t) => {
        const p = t.parentElement; if (!p || p.closest("[data-no-scroll-assist]")) return;
        if (p.dataset.scrollAuto || getComputedStyle(p).overflowX !== "visible") return;
        if (t.offsetWidth > p.clientWidth + 2) { p.style.overflowX = "auto"; p.dataset.scrollAuto = "1"; }
      });
      const next = new Set<HTMLElement>();
      document.querySelectorAll<HTMLElement>(`${SEL},[data-scroll-auto]`).forEach((el) => { if (!el.closest("[data-no-scroll-assist]") && !el.hasAttribute("data-no-scroll-assist")) next.add(el); });
      tracked.current = next;
      schedule();
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    const later = () => { clearTimeout(t); t = setTimeout(scan, 200); };
    scan();
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true });
    const iv = setInterval(scan, 2500);
    window.addEventListener("resize", later);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => { mo.disconnect(); clearInterval(iv); clearTimeout(t); window.removeEventListener("resize", later); window.removeEventListener("scroll", schedule, true); if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const go = (el: HTMLElement, d: number) => el.scrollBy({ left: d * Math.max(180, el.clientWidth * 0.7), behavior: "smooth" });
  return (
    <div aria-hidden={hits.length === 0} className="pointer-events-none fixed inset-0 z-30">
      {hits.map((h, i) => {
        const y = (h.top + h.bottom) / 2;
        const cls = "pointer-events-auto absolute grid size-8 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel text-ink shadow-md transition hover:scale-110 hover:border-accent active:scale-95";
        return (
          <div key={i}>
            {h.l && <button type="button" tabIndex={-1} aria-label="Rolar para a esquerda" onClick={() => go(h.el, -1)} className={cls} style={{ left: h.left + 6, top: y }}><ChevronLeft size={16} aria-hidden /></button>}
            {h.r && <button type="button" tabIndex={-1} aria-label="Rolar para a direita" onClick={() => go(h.el, 1)} className={cls} style={{ left: h.right - 38, top: y }}><ChevronRight size={16} aria-hidden /></button>}
          </div>
        );
      })}
    </div>
  );
}
