"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Painel flutuante (calendário, menus, listas): sai do painel/cartão onde o botão está (portal no <body>, posição fixa),
 * então nenhum overflow-hidden, vidro ou rolagem do pai corta ou prende o conteúdo. Abre para baixo, ou para cima se faltar espaço,
 * nunca sai da tela e rola por dentro se for maior que a área livre.
 */
export function Floating({ anchor, open, onClose, children, align = "left", className = "", width, role, label, matchWidth = false }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: ReactNode; align?: "left" | "right"; className?: string; width?: number | string; role?: string; label?: string; matchWidth?: boolean;
}) {
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number; w?: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  const place = () => {
    const a = anchor.current, p = pop.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect(), m = 8, gap = 6, vw = window.innerWidth, vh = window.innerHeight;
    const w = matchWidth ? r.width : p.offsetWidth, h = p.scrollHeight;
    const below = vh - r.bottom - gap - m, above = r.top - gap - m;
    const down = h <= below || below >= above;
    const maxH = Math.max(140, Math.min(h, down ? below : above));
    const top = down ? r.bottom + gap : Math.max(m, r.top - gap - maxH);
    const left = align === "right" ? Math.max(m, Math.min(r.right - w, vw - w - m)) : Math.max(m, Math.min(r.left, vw - w - m));
    setPos({ top, left, maxH, w: matchWidth ? r.width : undefined });
  };
  useLayoutEffect(() => { if (!open) { setPos(null); return; } place(); });
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { const t = e.target as Node; if (!pop.current?.contains(t) && !anchor.current?.contains(t)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const scroll = (e: Event) => { if (pop.current && e.target instanceof Node && pop.current.contains(e.target)) return; place(); }; // acompanha o botão ao rolar a página
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, true); window.addEventListener("resize", place);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", place); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !host) return null;
  const style: CSSProperties = { position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, maxHeight: pos?.maxH, width: pos?.w ?? width, visibility: pos ? "visible" : "hidden" };
  return createPortal(<div ref={pop} role={role} aria-label={label} style={style} className={`z-[96] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain ${className}`}>{children}</div>, host);
}
