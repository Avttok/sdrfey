"use client";

import { FileText, MapPin, Phone, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { BOARD_COLUMNS, fmtBRL, STAGE_META } from "@/config/deals";
import { fmtPhone } from "@/lib/format";
import { claimDealAction } from "@/modules/deals/actions";
import type { DealRow } from "@/modules/deals/queries";
import { AlertChip, StageChip } from "./deal-ui";

type Filter = "todas" | "minhas" | "grupo" | "avisos" | "fechadas";

function Card({ d, meId, canClaim }: { d: DealRow; meId: number; canClaim: boolean }) {
  const { run, pending } = useRun();
  const danger = d.alerts.some((a) => a.tone === "danger");
  const value = d.mainCents;
  const bar = d.color ?? STAGE_META[d.stage].color;
  return (
    <li className={`${panelCls} group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md ${danger ? "border-danger/50" : ""} ${d.expired ? "opacity-70" : ""}`} style={d.color ? { background: `color-mix(in srgb, ${d.color} 12%, var(--panel))` } : undefined}>
      <span aria-hidden className={`absolute inset-y-0 left-0 ${d.color ? "w-2" : "w-1"}`} style={{ background: bar }} />
      <Link href={`/negociacoes/${d.id}`} className="flex flex-1 flex-col gap-2 p-3.5 pl-5 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-accent/50">
        <p className="line-clamp-2 h-9 text-[14px] font-semibold leading-[18px]" title={d.company}>{d.company}</p>
        <p className="flex min-h-4 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {d.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{d.city}/{d.uf}</span>}
          {d.phone && <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden />{fmtPhone(d.phone)}</span>}
          {d.quoteNumber && <span className="figure inline-flex items-center gap-1"><FileText size={12} aria-hidden />Cot. {d.quoteNumber}</span>}
          {!d.city && !d.phone && !d.quoteNumber && <span>Sem dados de contato</span>}
        </p>
        {(d.alerts.length > 0 || d.expired) && (
          <span className="flex flex-wrap gap-1.5">
            {d.expired && <span className="inline-flex items-center rounded-full bg-sunk px-2.5 py-0.5 text-xs font-semibold text-muted">Fora da carteira</span>}
            {d.alerts.map((a) => <AlertChip key={a.kind} a={a} />)}
          </span>
        )}
      </Link>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 px-3.5 py-2.5 pl-5 text-xs text-muted">
        <span className="min-w-0 truncate" title={d.sdrName ? `SDR ${d.sdrName}` : undefined}>{d.sellerName ? <b className="font-semibold text-ink">{d.sellerId === meId ? "Você" : d.sellerName}</b> : "Sem vendedor"}</span>
        <span className="flex shrink-0 items-center gap-2">{value ? <b className="figure text-sm text-ink">{fmtBRL(value)}</b> : null}</span>
      </div>
      {!d.sellerId && canClaim && d.stage !== "ganho" && d.stage !== "perdido" && (
        <div className="px-3.5 pb-3.5 pl-5"><button type="button" disabled={pending} onClick={() => run(() => claimDealAction(d.id))} className={`${btnPrimary} relative z-10 w-full !py-2 !text-sm`}><UserPlus size={15} aria-hidden /> Assumir</button></div>
      )}
    </li>
  );
}

export function DealBoard({ deals, meId, canClaim, team }: { deals: DealRow[]; meId: number; canClaim: boolean; team: boolean }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = norm(q.trim());
  const digits = q.replace(/\D/g, "");
  const isOpen = (d: DealRow) => d.stage !== "ganho" && d.stage !== "perdido";
  const open = useMemo(() => deals.filter(isOpen), [deals]);
  const closed = useMemo(() => deals.filter((d) => !isOpen(d)), [deals]);
  /** Última coluna do quadro: o que foi faturado neste mês. */
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const billed = useMemo(() => deals.filter((d) => d.stage === "ganho" && (d.closedOn ?? d.closedAt ?? "").slice(0, 7) === month), [deals, month]);
  const counts = { todas: open.length, minhas: open.filter((d) => d.sellerId === meId).length, grupo: open.filter((d) => !d.sellerId).length, avisos: open.filter((d) => d.alerts.length).length, fechadas: closed.length };
  const bySearch = (d: DealRow) => !needle || norm(`${d.company} ${d.contactName ?? ""} ${d.city ?? ""} ${d.sellerName ?? ""} ${d.quoteNumber ?? ""}`).includes(needle) || (digits.length >= 3 && d.cnpj.includes(digits));
  const byFilter = (d: DealRow) => filter === "minhas" ? d.sellerId === meId : filter === "grupo" ? !d.sellerId : filter === "avisos" ? d.alerts.length > 0 : true;
  const billedShown = billed.filter(bySearch).filter((d) => filter === "minhas" ? d.sellerId === meId : filter === "todas");
  const shown = (filter === "fechadas" ? closed : open).filter((d) => !needle || norm(`${d.company} ${d.contactName ?? ""} ${d.city ?? ""} ${d.sellerName ?? ""} ${d.quoteNumber ?? ""}`).includes(needle) || (digits.length >= 3 && d.cnpj.includes(digits))).filter((d) => filter === "minhas" ? d.sellerId === meId : filter === "grupo" ? !d.sellerId : filter === "avisos" ? d.alerts.length > 0 : true);
  const chips: [Filter, string][] = [["todas", team ? "Todas abertas" : "Abertas"], ["minhas", "Minhas"], ["grupo", "Sem vendedor"], ["avisos", "Com aviso"], ["fechadas", "Encerradas"]];
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" aria-label="Buscar negociação" placeholder="Buscar por empresa, contato, cidade, vendedor, CNPJ ou nº da cotação" className={`${inputCls} !pl-10`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div role="tablist" aria-label="Filtrar negociações" className="flex flex-wrap gap-2">
        {chips.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${filter === k ? "border-transparent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}>
            {label}<span className={`figure rounded-full px-1.5 text-xs ${filter === k ? "bg-black/15" : "bg-sunk text-muted"} ${k === "avisos" && counts.avisos && filter !== k ? "!bg-danger/15 !text-danger" : ""}`}>{counts[k]}</span>
          </button>
        ))}
      </div>
      {filter === "fechadas" || filter === "avisos" || filter === "grupo" ? (
        shown.length ? <ul className="grid items-stretch gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">{shown.map((d) => <Card key={d.id} d={d} meId={meId} canClaim={canClaim} />)}</ul> : <Empty text={needle ? "Nenhuma negociação com essa busca." : filter === "grupo" ? "Nenhuma negociação esperando vendedor." : filter === "avisos" ? "Tudo em dia: nenhum aviso." : "Nenhuma negociação encerrada ainda."} />
      ) : shown.length === 0 && billedShown.length === 0 ? <Empty text={needle ? "Nenhuma negociação com essa busca." : "Nenhuma negociação aberta."} /> : (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(14.5rem,1fr))]">
          {BOARD_COLUMNS.map(({ key, stages }) => {
            const col = key === "ganho" ? billedShown : shown.filter((d) => stages.includes(d.stage));
            return (
              <section key={key} className="min-w-0 space-y-3 rounded-2xl border border-line bg-sunk/50 p-2.5">
                <header className="flex items-center justify-between gap-2 px-1.5 pt-1">
                  <span className="whitespace-nowrap"><StageChip stage={key} /></span>
                  <span className="figure whitespace-nowrap text-sm text-muted">{col.length}</span>
                </header>
                {col.some((x) => x.mainCents) && <p className="figure -mt-1 px-1.5 text-xs text-muted">{fmtBRL(col.reduce((a, x) => a + (x.mainCents ?? 0), 0))}</p>}
                <ul className="space-y-2.5">{col.map((d) => <Card key={d.id} d={d} meId={meId} canClaim={canClaim} />)}{col.length === 0 && <li className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted">Vazio</li>}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className={`${panelCls} p-8 text-center text-sm text-muted`}>{text}</p>;
}

