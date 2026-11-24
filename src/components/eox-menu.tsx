"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EoxIcon } from "@/components/brand-icons";
import { eoxPlaces, parseEoxUrl } from "@/modules/vocall/eox";

/** Botão roxo da EOX com seta: o botão abre a ação principal; a seta lista Perfil, Atendimentos e Conversas do cadastro. */
export function EoxMenu({ url, main, size = "md", full = false }: { url: string; /** Ação principal (ex.: Qualificar). Sem ela, o botão abre o Perfil. */ main?: { href: string; label: string; icon?: React.ReactNode }; size?: "sm" | "md" | "lg"; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k, true);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k, true); };
  }, [open]);
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
      {open && (
        <div role="menu" className={`absolute left-0 z-50 min-w-full overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl ${full ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}>
          {places.map((p) => <a key={p.key} role="menuitem" href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-semibold hover:bg-accent/10"><EoxIcon size={14} /> {p.label}</a>)}
        </div>
      )}
    </div>
  );
}
