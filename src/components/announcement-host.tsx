"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ANN_THEMES, type AnnView } from "@/config/announcements";

const KEY = "ann-closed";
const read = (): number[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)).slice(-100) : []; } catch { return []; } };

/** Card que cai do topo da tela com o aviso do Adm. Sempre fechável; quem fecha não vê de novo. */
export function AnnouncementCard({ a, onClose, preview }: { a: AnnView; onClose?: () => void; preview?: boolean }) {
  const t = ANN_THEMES[a.theme];
  const Icon = t.icon;
  return (
    <div role={a.theme === "urgente" ? "alert" : "status"} data-ann-effect={a.effect} className={`${preview ? "" : "ann-drop"} ann-card pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-3xl border-2 bg-panel shadow-2xl`} style={{ borderColor: `color-mix(in srgb, ${t.color} 60%, transparent)`, "--ann": t.color } as React.CSSProperties}>
      <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(105deg, color-mix(in srgb, ${t.color} 22%, transparent), color-mix(in srgb, ${t.color} 6%, transparent))` }} />
      {a.effect === "shine" && <span aria-hidden className="ann-shine absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
      <Icon aria-hidden size={96} strokeWidth={1.3} className="pointer-events-none absolute -bottom-5 -right-3 -rotate-12 opacity-[.12]" style={{ color: t.color }} />
      <div className="relative flex items-start gap-3 py-3 pl-4 pr-3">
        <span className="ann-icon mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${t.color}, color-mix(in srgb, ${t.color} 62%, #000))` }}><Icon size={19} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.color }}>{t.label}</p>
          <p className="font-semibold leading-snug">{a.title}</p>
          {a.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{a.body}</p>}
        </div>
        {onClose && <button type="button" aria-label="Fechar aviso" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-black/10 hover:text-ink"><X size={17} aria-hidden /></button>}
      </div>
    </div>
  );
}

export function AnnouncementHost() {
  const [items, setItems] = useState<AnnView[]>([]);
  const [closed, setClosed] = useState<number[]>([]);
  const load = useCallback(async () => {
    try { const r = await fetch("/api/announcements", { cache: "no-store" }); if (r.ok) setItems(((await r.json()) as { items: AnnView[] }).items ?? []); } catch { /* sem rede: tenta de novo no próximo ciclo */ }
  }, []);
  useEffect(() => {
    setClosed(read());
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    const v = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [load]);
  const close = (id: number) => { const next = [...closed, id]; setClosed(next); try { localStorage.setItem(KEY, JSON.stringify(next.slice(-100))); } catch { /* ignora */ } };
  const shown = items.filter((a) => !closed.includes(a.id));
  if (!shown.length) return null;
  return <div aria-live="polite" className="relative z-30 flex flex-col items-center gap-2 px-3 pt-3">{shown.map((a) => <AnnouncementCard key={a.id} a={a} onClose={() => close(a.id)} />)}</div>;
}
