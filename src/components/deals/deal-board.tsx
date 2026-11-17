"use client";

import { MapPin, Phone, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, panelCls } from "@/components/ui";
import { fmtBRL, OPEN_STAGES, STAGE_META } from "@/config/deals";
import { fmtPhone } from "@/lib/format";
import { claimDealAction } from "@/modules/deals/actions";
import type { DealRow } from "@/modules/deals/queries";
import { AlertChip, StageChip } from "./deal-ui";

type Filter = "todas" | "minhas" | "grupo" | "avisos" | "fechadas";

function Card({ d, meId, canClaim }: { d: DealRow; meId: number; canClaim: boolean }) {
  const { run, pending } = useRun();
  const danger = d.alerts.some((a) => a.tone === "danger");
  return (
    <li className={`${panelCls} group relative overflow-hidden transition hover:border-accent/50 hover:shadow-md ${danger ? "border-danger/50" : ""}`}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: STAGE_META[d.stage].color }} />
      <div className="space-y-2.5 p-3.5 pl-4">
        <Link href={`/negociacoes/${d.id}`} className="block space-y-1 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-accent/50">
          <p className="truncate font-semibold leading-tight">{d.company}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {d.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{d.city}/{d.uf}</span>}
            {d.phone && <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden />{fmtPhone(d.phone)}</span>}
          </p>
        </Link>
        {d.alerts.length > 0 && <div className="flex flex-wrap gap-1.5">{d.alerts.map((a) => <AlertChip key={a.kind} a={a} />)}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">{d.sellerName ? <>Vendedor: <b className="font-semibold text-ink">{d.sellerId === meId ? "você" : d.sellerName}</b></> : "Sem vendedor"}{d.sdrName ? <> · SDR {d.sdrName}</> : null}</span>
          {d.valueCents ? <b className="figure text-sm text-ink">{fmtBRL(d.valueCents)}</b> : null}
        </div>
        {!d.sellerId && canClaim && d.stage !== "ganho" && d.stage !== "perdido" && (
          <button type="button" disabled={pending} onClick={() => run(() => claimDealAction(d.id))} className={`${btnPrimary} relative z-10 w-full !py-2 !text-sm`}><UserPlus size={15} aria-hidden /> Assumir</button>
        )}
      </div>
    </li>
  );
}

export function DealBoard({ deals, meId, canClaim, team }: { deals: DealRow[]; meId: number; canClaim: boolean; team: boolean }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const open = useMemo(() => deals.filter((d) => OPEN_STAGES.includes(d.stage)), [deals]);
  const closed = useMemo(() => deals.filter((d) => !OPEN_STAGES.includes(d.stage)), [deals]);
  const counts = { todas: open.length, minhas: open.filter((d) => d.sellerId === meId).length, grupo: open.filter((d) => !d.sellerId).length, avisos: open.filter((d) => d.alerts.length).length, fechadas: closed.length };
  const shown = (filter === "fechadas" ? closed : open).filter((d) => filter === "minhas" ? d.sellerId === meId : filter === "grupo" ? !d.sellerId : filter === "avisos" ? d.alerts.length > 0 : true);
  const chips: [Filter, string][] = [["todas", team ? "Todas abertas" : "Abertas"], ["minhas", "Minhas"], ["grupo", "Sem vendedor"], ["avisos", "Com aviso"], ["fechadas", "Encerradas"]];
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Filtrar negociações" className="flex flex-wrap gap-2">
        {chips.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${filter === k ? "border-transparent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}>
            {label}<span className={`figure rounded-full px-1.5 text-xs ${filter === k ? "bg-black/15" : "bg-sunk text-muted"} ${k === "avisos" && counts.avisos && filter !== k ? "!bg-danger/15 !text-danger" : ""}`}>{counts[k]}</span>
          </button>
        ))}
      </div>
      {filter === "fechadas" || filter === "avisos" || filter === "grupo" ? (
        shown.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((d) => <Card key={d.id} d={d} meId={meId} canClaim={canClaim} />)}</ul> : <Empty text={filter === "grupo" ? "Nenhuma negociação esperando vendedor." : filter === "avisos" ? "Tudo em dia: nenhum aviso." : "Nenhuma negociação encerrada ainda."} />
      ) : shown.length === 0 ? <Empty text="Nenhuma negociação por aqui. Quando um SDR repassar um lead, ele aparece nesta tela na hora." /> : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {OPEN_STAGES.map((st) => {
            const col = shown.filter((d) => d.stage === st);
            return (
              <section key={st} className="min-w-0 space-y-3">
                <header className="flex items-center justify-between gap-2 px-1">
                  <StageChip stage={st} /><span className="figure text-sm text-muted">{col.length}</span>
                </header>
                <ul className="space-y-3">{col.map((d) => <Card key={d.id} d={d} meId={meId} canClaim={canClaim} />)}{col.length === 0 && <li className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">Vazio</li>}</ul>
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

