"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EoxIcon } from "@/components/brand-icons";
import { eoxPlaces, parseEoxUrl } from "@/modules/vocall/eox";

/** Botão roxo da EOX com seta: o botão abre a ação principal; a seta lista Perfil, Atendimentos e Conversas do cadastro. */
export function EoxMenu({ url, main, size = "md", full = false }: { url: string; /** Ação principal (ex.: Qualificar). Sem ela, o botão abre o Perfil. */ main?: { href: string; label: string; icon?: React.ReactNode }; size?: "sm" | "md" | "lg"; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k, true);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k, true); };
  }, [open]);
  /* o menu sai do painel (portal + posição fixa): dentro de cartões com overflow ele ficava cortado */
  useLayoutEffect(() => {
    if (!open || !box.current) { setPos(null); return; }
    const r = box.current.getBoundingClientRect(), w = pop.current?.offsetWidth ?? 200, h = pop.current?.offsetHeight ?? 160, vw = window.innerWidth, vh = window.innerHeight;
    const down = vh - r.bottom - 8 >= h || r.top < h + 8;
    setPos({ top: down ? r.bottom + 6 : r.top - h - 6, left: Math.max(8, Math.min(r.left, vw - w - 8)) });
  }, [open]);
  useEffect(() => { if (!open) return; const c = (e: Event) => { if (!pop.current?.contains(e.target as Node)) setOpen(false); }; window.addEventListener("scroll", c, true); window.addEventListener("resize", () => setOpen(false)); return () => window.removeEventListener("scroll", c, true); }, [open]);
  const ref = parseEoxUrl(url) ?? (() => { try { const u = new URL(url); const id = u.searchParams.get("parent_id") ?? ""; return /^\d+$/.test(id) ? { crmid: id, origin: u.origin } : null; } catch { return null; } })();
  if (!ref) return null;
  const places = eoxPlaces(ref.origin, ref.crmid);
  const h = size === "lg" ? "min-h-12 text-base" : size === "sm" ? "min-h-7 text-xs" : "min-h-9 text-sm";
  const icon = size === "sm" ? 13 : 16;
  const bg = { background: "linear-gradient(135deg,#7a3a94,#692e81)" };
  return (
    <div ref={box} className={`relative ${full ? "flex w-full" : "inline-flex"}`}>
      <a href={main?.href ?? places[0].href} target="_blank" rel="noopener noreferrer" style={bg} className={`inline-flex ${h} flex-1 items-center justify-center gap-2 rounded-l-xl px-3 font-bold text-white transition hover:brightness-110`}>
        {main?.icon ?? <EoxIcon size={icon} />} {main?.label ?? "EOX"}
      </a>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Outros lugares na EOX" aria-expanded={open} style={{ ...bg, borderLeft: "1px solid rgba(255,255,255,.3)" }} className={`inline-flex ${h} w-9 items-center justify-center rounded-r-xl text-white transition hover:brightness-110`}><ChevronDown size={icon} aria-hidden className={open ? "rotate-180 transition" : "transition"} /></button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={pop} role="menu" style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }} className="z-[90] min-w-44 overflow-hidden rounded-xl card-edge card-surface py-1 shadow-xl">
          {places.map((p) => <a key={p.key} role="menuitem" href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-semibold hover:bg-accent/10"><EoxIcon size={14} /> {p.label}</a>)}
        </div>
      , document.body)}
    </div>
  );
}
