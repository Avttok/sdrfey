"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const toBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** Converte "DD/MM/AAAA" em "AAAA-MM-DD"; devolve "" se a data não existir. */
export function brToIso(br: string): string {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const t = new Date(Date.UTC(+y, +mo - 1, +d));
  return t.getUTCFullYear() === +y && t.getUTCMonth() === +mo - 1 && t.getUTCDate() === +d ? `${y}-${mo}-${d}` : "";
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Dias de um mês em grade de semanas (domingo primeiro); null = célula vazia. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
}

/** Campo de data: digite DD/MM/AAAA ou clique no calendário. Sempre DD/MM/AAAA, em qualquer navegador. */
export function DateInput({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label: string }) {
  const [text, setText] = useState(toBr(value));
  const [open, setOpen] = useState(false);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIso();
  const [view, setView] = useState({ y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setText(toBr(value)), [value]);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  const shift = (d: number) => setView(({ y, m }) => { const t = new Date(Date.UTC(y, m + d, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; });
  const pick = (iso: string) => { onChange(iso); setOpen(false); };
  const today = todayIso();

  return (
    <div ref={box} className="relative">
      <input
        className="h-11 w-full rounded-lg border border-line bg-panel pl-3 pr-10 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        inputMode="numeric" placeholder="DD/MM/AAAA" aria-label={label} maxLength={10} value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
          const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
          setText(masked);
          if (masked === "") onChange("");
          else if (masked.length === 10) { const iso = brToIso(masked); if (iso) { onChange(iso); setView({ y: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1 }); } }
        }}
      />
      <button type="button" aria-label={`Abrir calendário: ${label}`} aria-expanded={open} onClick={() => setOpen(!open)} className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-sunk hover:text-ink">
        <CalendarDays size={18} aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Calendário" className="absolute left-0 top-12 z-40 w-64 rounded-xl border border-line bg-panel p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="rounded-md p-1.5 hover:bg-sunk"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold">{MONTHS[view.m]} {view.y}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="rounded-md p-1.5 hover:bg-sunk"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted">{WEEK.map((w, i) => <span key={i} className="py-1">{w}</span>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid(view.y, view.m).map((d, i) => {
              if (d === null) return <span key={i} />;
              const iso = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
              const sel = iso === value;
              return (
                <button key={i} type="button" onClick={() => pick(iso)} aria-pressed={sel}
                  className={`figure h-8 rounded-md text-sm ${sel ? "bg-accent font-bold text-on-accent" : iso === today ? "border border-accent hover:bg-sunk" : "hover:bg-sunk"}`}>{d}</button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => pick(today)}>Hoje</button>
            <button type="button" className="text-muted hover:underline" onClick={() => pick("")}>Limpar</button>
          </div>
        </div>
      )}
    </div>
  );
}
