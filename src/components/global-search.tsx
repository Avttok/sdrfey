"use client";

import { Archive, Building2, CalendarCheck, CornerDownLeft, FileText, Handshake, LayoutGrid, Loader2, Mail, MapPin, ScrollText, Search, ShieldCheck, Truck, UserRound, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SearchHit, SearchKind } from "@/app/api/search/route";

const META: Record<SearchKind, { label: string; icon: LucideIcon; color: string }> = {
  page: { label: "Páginas", icon: LayoutGrid, color: "#6366f1" },
  admin: { label: "Painel do Adm", icon: ShieldCheck, color: "#ec4899" },
  lead: { label: "Leads", icon: Building2, color: "#0ea5e9" },
  person: { label: "Contatos", icon: UserRound, color: "#10b981" },
  deal: { label: "Negociações", icon: Handshake, color: "#f59e0b" },
  visit: { label: "Visitas", icon: CalendarCheck, color: "#8b5cf6" },
  rep: { label: "Representantes", icon: MapPin, color: "#14b8a6" },
  carrier: { label: "Transportadoras", icon: Truck, color: "#64748b" },
  email: { label: "Modelos de e-mail", icon: Mail, color: "#ef4444" },
  script: { label: "Roteiros", icon: ScrollText, color: "#d946ef" },
};
void FileText; void Archive;

/** Lupa ao lado do sino: abre uma busca única por tudo que a pessoa pode ver no sistema. */
export function GlobalSearch({ side = false }: { side?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); } if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 30); else { setQ(""); setHits([]); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal, cache: "no-store" }); const d = (await r.json()) as { hits: SearchHit[] }; setHits(d.hits); setCur(0); } catch { /* cancelada */ }
      setBusy(false);
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const go = (h: SearchHit) => { setOpen(false); router.push(h.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => Math.min(hits.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter" && hits[cur]) go(hits[cur]);
  };

  let lastKind: SearchKind | null = null;
  return (
    <>
      <button type="button" aria-label="Pesquisar no sistema" title="Pesquisar (Ctrl+K)" onClick={() => setOpen(true)} className={`grid size-10 place-items-center rounded-xl text-muted transition hover:bg-sunk hover:text-ink ${side ? "" : ""}`}><Search size={20} aria-hidden /></button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/45 px-3 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-label="Pesquisar" className="menu-up w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              {busy ? <Loader2 size={20} aria-hidden className="shrink-0 animate-spin text-accent" /> : <Search size={20} aria-hidden className="shrink-0 text-accent" />}
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Leads, contatos, visitas, páginas, configurações…" aria-label="O que você procura?" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted" style={{ outline: "none", boxShadow: "none" }} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-sunk hover:text-ink"><X size={16} aria-hidden /></button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto p-2">
              {hits.map((h, i) => {
                const m = META[h.kind]; const Icon = m.icon; const head = lastKind !== h.kind; lastKind = h.kind;
                return (
                  <li key={`${h.kind}-${i}`}>
                    {head && <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">{m.label}</p>}
                    <button type="button" onClick={() => go(h)} onMouseEnter={() => setCur(i)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${i === cur ? "bg-sunk" : ""}`}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: m.color }}><Icon size={17} aria-hidden /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{h.title}</span>{h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}</span>
                      {i === cur && <CornerDownLeft size={14} aria-hidden className="shrink-0 text-muted" />}
                    </button>
                  </li>
                );
              })}
              {q.trim().length < 2 && <li className="px-4 py-8 text-center text-sm text-muted"><Search size={28} aria-hidden className="mx-auto mb-2 opacity-40" />Digite pelo menos 2 letras. Dica: <kbd className="rounded border border-line px-1">Ctrl</kbd> + <kbd className="rounded border border-line px-1">K</kbd> abre a busca de qualquer tela.</li>}
              {q.trim().length >= 2 && !busy && hits.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nada encontrado para “{q.trim()}”.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
