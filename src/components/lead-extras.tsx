"use client";

import { CalendarCheck, FileText, Handshake, History, MapPin, Phone, ScrollText, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { ScriptRunsPanel } from "@/components/script-runs-panel";
import { SectionCard } from "@/components/section-card";
import { AndamentosTimeline, SalesSummaryPanel, VisitsPanel } from "@/components/deals/commercial-panels";
import { fmtBRL } from "@/config/deals";
import { fmtDateTime } from "@/lib/format";
import type { LeadCommercial } from "@/modules/deals/lead-commercial";
import type { ScriptRunView } from "@/modules/scripts/runs-query";

function Kpi({ icon: I, label, value, sub, tone }: { icon: typeof Phone; label: string; value: string; sub?: string; tone?: "ok" }) {
  return (
    <div className="lift rounded-2xl border border-line bg-panel p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><I size={14} aria-hidden /> {label}</p>
      <p className={`figure mt-1 text-2xl font-semibold leading-tight ${tone === "ok" ? "text-ok" : ""}`}>{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Números do cliente: contatos, pessoas, roteiros usados, negociações, cotações, faturado e visitas. */
export function LeadKpis({ comm, runs, people, channels, lastAt }: { comm: LeadCommercial | null; runs: ScriptRunView[]; people: number; channels: number; lastAt: string | null }) {
  const won = comm?.deals.filter((d) => d.stage === "ganho") ?? [];
  const billed = won.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  const lastCall = runs[0]?.startedAt ?? lastAt;
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumo do cliente">
      <Kpi icon={ScrollText} label="Ligações com roteiro" value={String(runs.length)} sub={lastCall ? `Última: ${fmtDateTime(lastCall).slice(0, 10)}` : "Nenhuma ainda"} />
      <Kpi icon={Users} label="Pessoas e contatos" value={`${people} · ${channels}`} sub="pessoas · telefones/e-mails" />
      <Kpi icon={Handshake} label="Negociações" value={String(comm?.deals.length ?? 0)} sub={won.length ? `${won.length} faturada${won.length === 1 ? "" : "s"}` : "Nenhuma faturada"} />
      <Kpi icon={FileText} label="Cotações" value={String(comm?.quotes.length ?? 0)} sub="enviadas ao cliente" />
      <Kpi icon={Trophy} label="Faturado" value={fmtBRL(billed)} sub="soma das vendas" tone={billed > 0 ? "ok" : undefined} />
      <Kpi icon={CalendarCheck} label="Visitas" value={String(comm?.visits.length ?? 0)} sub="com representante ou vendedor" />
    </div>
  );
}

type Tab = "roteiros" | "negocios" | "andamentos" | "visitas";
/** Registros do cliente em abas, em vez de uma rolagem longa. */
export function LeadRecords({ comm, runs, showVisits }: { comm: LeadCommercial | null; runs: ScriptRunView[]; showVisits: boolean }) {
  const [tab, setTab] = useState<Tab>("roteiros");
  const TABS: { k: Tab; l: string; i: typeof History; n: number; on: boolean }[] = [
    { k: "roteiros", l: "Roteiros das ligações", i: ScrollText, n: runs.length, on: true },
    { k: "negocios", l: "Negociações e vendas", i: Handshake, n: comm?.deals.length ?? 0, on: !!comm },
    { k: "andamentos", l: "Andamentos", i: History, n: comm?.events.length ?? 0, on: !!comm },
    { k: "visitas", l: "Visitas", i: MapPin, n: comm?.visits.length ?? 0, on: !!comm && showVisits },
  ];
  const tabs = TABS.filter((t) => t.on);
  return (
    <SectionCard icon={History} title="Registros do cliente">
      <div role="tablist" aria-label="Registros do cliente" className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-sunk/50 p-1">
        {tabs.map(({ k, l, i: I, n }) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition ${tab === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>
            <I size={15} aria-hidden /> {l}{n ? <span className={`figure rounded-full px-1.5 text-xs ${tab === k ? "bg-white/25" : "bg-line/60"}`}>{n}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "roteiros" && (runs.length ? <ScriptRunsPanel runs={runs} /> : <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nenhuma ligação com roteiro para este cliente ainda.</p>)}
        {tab === "negocios" && comm && <SalesSummaryPanel deals={comm.deals} quotes={comm.quotes} />}
        {tab === "andamentos" && comm && <AndamentosTimeline events={comm.events} showDeal maxH="max-h-[34rem]" />}
        {tab === "visitas" && comm && <VisitsPanel visits={comm.visits} />}
      </div>
    </SectionCard>
  );
}
