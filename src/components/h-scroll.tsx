"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Faixa que rola para o lado, com setas (aparecem só quando há conteúdo escondido) e arraste com o dedo ou a roda.
 * Use em qualquer fileira de botões/abas que possa passar da largura da tela.
 */
export function HScroll({ children, className = "", label, role }: { children: React.ReactNode; className?: string; label?: string; role?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const check = useCallback(() => {
    const el = ref.current; if (!el) return;
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    check();
    const ro = new ResizeObserver(check); ro.observe(el); Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener("scroll", check, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, [check, children]);
  const go = (d: number) => ref.current?.scrollBy({ left: d * Math.max(160, (ref.current?.clientWidth ?? 300) * 0.7), behavior: "smooth" });
  const arrow = (side: "l" | "r") => (
    <button type="button" tabIndex={-1} aria-label={side === "l" ? "Rolar para a esquerda" : "Rolar para a direita"} onClick={() => go(side === "l" ? -1 : 1)}
      className={`absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel text-ink shadow-md transition hover:scale-110 ${side === "l" ? "left-0" : "right-0"}`}>
      {side === "l" ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
    </button>
  );
  return (
    <div className="relative min-w-0">
      {edge.l && arrow("l")}
      <div ref={ref} role={role} aria-label={label} className={`no-sb overflow-x-auto ${edge.l ? "pl-9" : ""} ${edge.r ? "pr-9" : ""} ${className}`}>{children}</div>
      {edge.r && arrow("r")}
    </div>
  );
}
