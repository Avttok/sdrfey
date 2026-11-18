"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateInput } from "@/components/date-input";
import { useBusyWhile } from "@/components/toast";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const shiftDay = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const shiftMonth = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

/** Filtro de período das Metas: um dia (SDR) ou um mês (Vendas). Muda o endereço (?d= / ?m=) e a página recarrega com os números daquele período. */
export function PeriodFilter({ kind, value, max }: { kind: "day" | "month"; value: string; max: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [pending, start] = useTransition();
  useBusyWhile(pending, "Carregando…");
  const key = kind === "day" ? "d" : "m";
  const go = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v === max) q.delete(key); else q.set(key, v);
    start(() => router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false }));
  };
  const prev = kind === "day" ? shiftDay(value, -1) : shiftMonth(value, -1);
  const next = kind === "day" ? shiftDay(value, 1) : shiftMonth(value, 1);
  const months = Array.from({ length: 18 }, (_, i) => shiftMonth(max, -i));
  const btn = "grid size-9 place-items-center rounded-lg border border-line bg-panel text-muted transition hover:text-ink disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} aria-label={kind === "day" ? "Dia anterior" : "Mês anterior"} onClick={() => go(prev)}><ChevronLeft size={16} aria-hidden /></button>
      {kind === "day"
        ? <div className="w-40"><DateInput label="Dia das metas" value={value} onChange={(d) => d && d <= max && go(d)} /></div>
        : <select aria-label="Mês das metas" className="h-9 rounded-lg border border-line bg-panel px-3 text-sm" value={value} onChange={(e) => go(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{MONTHS[Number(m.slice(5)) - 1]} de {m.slice(0, 4)}</option>)}
          </select>}
      <button type="button" className={btn} aria-label={kind === "day" ? "Próximo dia" : "Próximo mês"} disabled={next > max} onClick={() => go(next)}><ChevronRight size={16} aria-hidden /></button>
      {value !== max && <button type="button" className="h-9 rounded-lg border border-line bg-panel px-3 text-sm font-medium transition hover:text-accent" onClick={() => go(max)}>{kind === "day" ? "Hoje" : "Mês atual"}</button>}
    </div>
  );
}
