"use client";

import Link from "next/link";
import { CalendarCheck, FileText, History, NotebookPen, PhoneCall, MessageCircle, Mail, Trophy, XCircle, CalendarClock, UserPlus, Handshake } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { StageChip } from "@/components/deals/deal-ui";
import { VisitCodeChip, VisitStatusChip } from "@/components/visit-row";
import { DEAL_EVENT_LABEL, fmtBRL } from "@/config/deals";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { CommDeal, CommEvent, CommQuote, CommVisit } from "@/modules/deals/lead-commercial";

const ICON: Record<string, typeof PhoneCall> = { ligacao: PhoneCall, whatsapp: MessageCircle, email: Mail, cotacao: FileText, nota: NotebookPen, ganho: Trophy, perdido: XCircle, retorno: CalendarClock, criado: UserPlus, assumido: UserPlus };
const kg = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
/** Grupos do filtro: o que o vendedor registra em "Registrar andamento" (contatos, anotações, cotações, retornos e encerramentos). */
const GROUPS: [string, string, string[]][] = [
  ["all", "Tudo", []],
  ["contato", "Contatos", ["ligacao", "whatsapp", "email"]],
  ["nota", "Anotações", ["nota"]],
  ["cotacao", "Cotações", ["cotacao"]],
  ["retorno", "Retornos", ["retorno"]],
  ["fim", "Encerramentos", ["ganho", "perdido", "reaberto"]],
];

/** Linha do tempo (sem moldura), com filtro por tipo. Usada no painel da negociação e na página do lead. */
export function AndamentosTimeline({ events, showDeal = false, maxH = "max-h-[28rem]" }: { events: CommEvent[]; showDeal?: boolean; maxH?: string }) {
  const [g, setG] = useState("all");
  const counts = useMemo(() => Object.fromEntries(GROUPS.map(([k, , kinds]) => [k, k === "all" ? events.length : events.filter((e) => kinds.includes(e.kind)).length])), [events]);
  const shown = useMemo(() => { const kinds = GROUPS.find(([k]) => k === g)?.[2] ?? []; return g === "all" ? events : events.filter((e) => kinds.includes(e.kind)); }, [events, g]);
  if (events.length === 0) return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nenhum andamento ainda.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar andamentos">
        {GROUPS.filter(([k]) => k === "all" || counts[k] > 0).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={g === k} onClick={() => setG(k)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${g === k ? "border-accent bg-accent/12 text-accent" : "border-line text-muted hover:bg-sunk"}`}>{l} <span className="figure">{counts[k]}</span></button>
        ))}
      </div>
      <div className={`${maxH} overflow-y-auto py-1 pl-4 pr-1`}><ol className="relative space-y-4 border-l border-line pl-5">
        {shown.map((e) => { const I = ICON[e.kind] ?? NotebookPen; return (
          <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[31px] grid size-6 place-items-center rounded-full border border-line bg-panel text-accent"><I size={12} aria-hidden /></span>
            <p className="font-medium">{DEAL_EVENT_LABEL[e.kind] ?? e.kind}{e.valueCents ? <span className="figure ml-1.5 whitespace-nowrap text-muted">{fmtBRL(e.valueCents)}</span> : null}{showDeal && <Link href={`/negociacoes/${e.dealId}`} className="ml-2 text-xs font-normal text-accent hover:underline">negociação #{e.dealId}</Link>}</p>
            {e.note && <p className="whitespace-pre-wrap break-words text-muted">{e.note}</p>}
            <p className="text-xs text-muted">{fmtDateTime(e.at)}{e.by ? ` · ${e.by}` : ""}</p>
          </li>
        ); })}
        {shown.length === 0 && <li className="text-sm text-muted">Nada neste filtro.</li>}
      </ol></div>
    </div>
  );
}

/** Linha do tempo de tudo o que foi registrado na negociação, em um cartão. */
export function AndamentosPanel({ events, title = "Andamentos registrados", showDeal = false }: { events: CommEvent[]; title?: string; showDeal?: boolean }) {
  return (
    <SectionCard icon={History} title={`${title}${events.length ? ` (${events.length})` : ""}`}>
      <AndamentosTimeline events={events} showDeal={showDeal} />
    </SectionCard>
  );
}

/** Visitas marcadas para o cliente (só leitura; quem confirma usa a tela de Visitas). */
export function VisitsPanel({ visits }: { visits: CommVisit[] }) {
  return (
    <SectionCard icon={CalendarCheck} title={`Visitas marcadas${visits.length ? ` (${visits.length})` : ""}`}>
      {visits.length === 0 ? <p className="text-sm text-muted">Nenhuma visita marcada para este cliente.</p> : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className={`rounded-xl border border-line bg-sunk/40 p-3 text-sm ${v.status === "cancelada" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2"><VisitCodeChip code={v.code} /><VisitStatusChip status={v.status} /><span className="flex-1" />
                <Link href={`/visitas?v=${v.id}`} className="text-xs font-medium text-accent hover:underline">Abrir visita</Link></div>
              <p className="mt-2 font-medium">{v.visitDate ? `Visita em ${fmtDate(v.visitDate)}` : "Data não informada"}</p>
              <p className="text-xs text-muted">{v.kind === "seller" ? `Vendedores SDR: ${v.sellerName ?? "grupo dos vendedores"}` : v.repName ? `Representante: ${v.repName}` : "Representante não definido"} · agendada {fmtDateTime(v.at)}{v.by ? ` por ${v.by}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Negociações, vendas e cotações do cliente, em um só quadro. */
export function SalesSummaryPanel({ deals, quotes }: { deals: CommDeal[]; quotes: CommQuote[] }) {
  const won = deals.filter((d) => d.stage === "ganho");
  const wonTotal = won.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  return (
    <SectionCard icon={Handshake} title="Negociações, vendas e cotações">
      {deals.length === 0 ? <p className="text-sm text-muted">Este cliente ainda não tem negociação.</p> : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["Negociações", String(deals.length)], ["Cotações", String(quotes.length)], ["Vendas", `${won.length} · ${fmtBRL(wonTotal)}`]] as const).map(([l, v]) => (
              <div key={l} className="rounded-xl bg-sunk/50 px-2 py-2.5"><p className="text-[11px] text-muted">{l}</p><p className="figure whitespace-nowrap text-sm font-bold">{v}</p></div>
            ))}
          </div>
          <ul className="space-y-2">
            {deals.map((d) => (
              <li key={d.id} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><StageChip stage={d.stage} /><span className="text-xs text-muted">{d.sellerName ? `com ${d.sellerName}` : "sem vendedor"}</span><span className="flex-1" />
                  <span className="figure whitespace-nowrap font-semibold">{fmtBRL(d.mainCents)}</span></div>
                <p className="mt-1 text-xs text-muted">Aberta em {fmtDate(d.createdAt)}{d.orderNumber ? ` · pedido ${d.orderNumber}` : ""}{d.closedOn ? ` · fechada em ${fmtDate(d.closedOn)}` : ""}{d.weightKg ? ` · ${kg(d.weightKg)}` : ""}</p>
                {quotes.filter((q) => q.dealId === d.id).length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-line pt-2">
                    {quotes.filter((q) => q.dealId === d.id).map((q) => (
                      <li key={q.id} className="flex flex-wrap items-center gap-x-3 text-xs"><FileText size={12} className="text-muted" aria-hidden /><b>Cotação {q.number ?? q.id}</b><span className="text-muted">{q.quoteDate ? fmtDate(q.quoteDate) : ""}</span><span className="flex-1" />{q.weightKg ? <span className="whitespace-nowrap text-muted">{kg(q.weightKg)}</span> : null}<span className="figure whitespace-nowrap font-medium">{fmtBRL(q.netCents ?? q.totalCents)}</span></li>
                    ))}
                  </ul>
                )}
                <Link href={`/negociacoes/${d.id}`} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">Abrir negociação</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
