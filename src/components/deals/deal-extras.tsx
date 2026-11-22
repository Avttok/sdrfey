"use client";

import { Building2, CalendarClock, FileText, History, MapPin, Mail, MessageSquareQuote, Phone, ScrollText, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/section-card";
import { ScriptRunsPanel } from "@/components/script-runs-panel";
import { fmtBRL } from "@/config/deals";
import { fmtDateTime, fmtPhone } from "@/lib/format";
import type { ClientHistory } from "@/modules/deals/history";
import type { CommVisit } from "@/modules/deals/lead-commercial";
import type { DealRow } from "@/modules/deals/queries";
import type { ScriptRunView } from "@/modules/scripts/runs-query";
import { ClientHistoryView } from "./client-history";
import { VisitsPanel } from "./commercial-panels";

export type DealPerson = { id: number; name: string; roleTitle: string | null; extension: string | null; notes: string | null; phones: string[]; emails: string[] };

const days = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);

function Kpi({ icon: I, label, value, sub, tone }: { icon: typeof Phone; label: string; value: string; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="lift rounded-2xl border border-line bg-panel p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><I size={14} aria-hidden /> {label}</p>
      <p className={`figure mt-1 text-2xl font-semibold leading-tight ${tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : ""}`}>{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Faixa de números da negociação: tempo no funil, último contato, cotações, ligações com roteiro, andamentos e visitas. */
export function DealKpis({ deal, quotes, runs, events, visits }: { deal: DealRow; quotes: number; runs: number; events: number; visits: number }) {
  const open = days(deal.closedAt ?? null) ?? days(deal.createdAt);
  const last = days(deal.lastContactAt);
  const closed = deal.stage === "ganho" || deal.stage === "perdido";
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumo da negociação">
      <Kpi icon={CalendarClock} label={closed ? "Tempo até fechar" : "No funil há"} value={open == null ? "—" : `${open} ${open === 1 ? "dia" : "dias"}`} sub={`Criada em ${fmtDateTime(deal.createdAt).slice(0, 10)}`} />
      <Kpi icon={Phone} label="Último contato" value={last == null ? "Nunca" : last === 0 ? "Hoje" : `${last} ${last === 1 ? "dia" : "dias"}`} sub={deal.lastContactAt ? fmtDateTime(deal.lastContactAt) : "Sem contato registrado"} tone={!closed && (last == null || last >= 5) ? "warn" : undefined} />
      <Kpi icon={FileText} label="Cotações" value={String(quotes)} sub={deal.valueCents ? `Última: ${fmtBRL(deal.valueCents)}` : "Nenhuma enviada"} />
      <Kpi icon={ScrollText} label="Ligações com roteiro" value={String(runs)} sub={runs ? "Veja na aba Roteiros" : "Ainda não usou roteiro"} />
      <Kpi icon={MessageSquareQuote} label="Andamentos" value={String(events)} sub="Contatos e anotações" />
      <Kpi icon={MapPin} label="Visitas" value={String(visits)} sub={visits ? "Veja na aba Visitas" : "Nenhuma marcada"} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="break-words text-sm">{value || <span className="text-muted">—</span>}</dd></div>;
}

function ClientData({ deal, people }: { deal: DealRow; people: DealPerson[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Item label="CNPJ" value={<span className="figure">{deal.cnpj}</span>} />
        <Item label="Código SAP" value={deal.sapCode} />
        <Item label="Endereço" value={deal.addressLine} />
        <Item label="Cidade/UF" value={[deal.city, deal.uf].filter(Boolean).join("/")} />
        <Item label="Inscrição estadual" value={deal.stateReg} />
        <Item label="Condição de pagamento" value={deal.paymentTerms} />
        <Item label="SDR de origem" value={deal.sdrName} />
        <Item label="Recado do SDR" value={deal.handoffNote} />
        <Item label="Assumida em" value={deal.claimedAt ? fmtDateTime(deal.claimedAt) : null} />
        <Item label="Reativação" value={deal.isReactivation ? "Sim" : "Não"} />
      </dl>
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><Users size={14} aria-hidden /> Pessoas da empresa ({people.length})</p>
        {people.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">Nenhuma pessoa cadastrada. Adicione no lead completo.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id} className="rounded-xl border border-line bg-sunk/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold"><UserRound size={14} className="text-accent" aria-hidden /> {p.name}</p>
              {(p.roleTitle || p.extension) && <p className="text-xs text-muted">{[p.roleTitle, p.extension && `ramal ${p.extension}`].filter(Boolean).join(" · ")}</p>}
              {p.phones.map((t) => <p key={t} className="figure flex items-center gap-1.5"><Phone size={12} className="text-muted" aria-hidden /><a href={`tel:+55${t}`} className="hover:text-accent">{fmtPhone(t)}</a></p>)}
              {p.emails.map((m) => <p key={m} className="flex items-center gap-1.5 truncate"><Mail size={12} className="text-muted" aria-hidden /><a href={`mailto:${m}`} className="truncate hover:text-accent">{m}</a></p>)}
              {p.notes && <p className="mt-1 text-xs text-muted">{p.notes}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type Tab = "roteiros" | "historico" | "visitas" | "cliente";
/** Registros da negociação em abas: roteiros das ligações, histórico do cliente, visitas e dados do cliente. */
export function DealRecords({ deal, runs, history, visits, people }: { deal: DealRow; runs: ScriptRunView[]; history: ClientHistory | null; visits: CommVisit[]; people: DealPerson[] }) {
  const [tab, setTab] = useState<Tab>("roteiros");
  const TABS: { k: Tab; l: string; i: typeof History; n?: number }[] = [
    { k: "roteiros", l: "Roteiros das ligações", i: ScrollText, n: runs.length },
    { k: "historico", l: "Histórico do cliente", i: History },
    { k: "visitas", l: "Visitas", i: MapPin, n: visits.length },
    { k: "cliente", l: "Dados do cliente", i: Building2, n: people.length },
  ];
  return (
    <SectionCard icon={History} title="Registros">
      <div role="tablist" aria-label="Registros da negociação" className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-sunk/50 p-1">
        {TABS.map(({ k, l, i: I, n }) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition ${tab === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>
            <I size={15} aria-hidden /> {l}{n ? <span className={`figure rounded-full px-1.5 text-xs ${tab === k ? "bg-white/25" : "bg-line/60"}`}>{n}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "roteiros" && (runs.length ? <ScriptRunsPanel runs={runs} /> : <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nenhuma ligação com roteiro para este cliente ainda. Quando alguém atender usando um roteiro, o passo a passo aparece aqui.</p>)}
        {tab === "historico" && (history ? <ClientHistoryView h={history} maxH="max-h-[34rem]" /> : <p className="text-sm text-muted">Sem histórico.</p>)}
        {tab === "visitas" && <VisitsPanel visits={visits} />}
        {tab === "cliente" && <ClientData deal={deal} people={people} />}
      </div>
    </SectionCard>
  );
}
