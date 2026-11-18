import { CircleDollarSign, Gift, Target } from "lucide-react";
import { panelCls } from "@/components/ui";
import { GoalsOff } from "@/components/goals-overview";
import { fmtBRL } from "@/config/deals";
import type { SellerPace } from "@/config/pace";
import { attainment, SELLER_METRICS, type SellerActuals, type SellerEnabled, type SellerTargets, type SellerWeights } from "@/config/seller-goals";

const nf = new Intl.NumberFormat("pt-BR");
const val = (kind: "count" | "money", v: number) => (kind === "money" ? fmtBRL(Math.round(v * 100)) : nf.format(v));

const fmtDay = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const rn = (kind: "count" | "money", v: number) => val(kind, kind === "money" ? Math.round(v) : Math.round(v * 10) / 10);

/** Ritmo do mês: média por dia útil, projeção para o fim do mês, o que precisa por dia e quando bate a meta. */
function PaceLine({ kind, p }: { kind: "count" | "money"; p: SellerPace }) {
  if (p.hit) return <p className="mt-2 text-xs font-semibold text-ok">Meta batida no mês.</p>;
  return (
    <div className="mt-2.5 space-y-1 text-xs text-muted">
      <p>Ritmo <b className="figure text-ink">{rn(kind, p.perDay)}</b>/dia útil · projeção do mês <b className={`figure ${p.onTrack ? "text-ok" : "text-warn"}`}>{rn(kind, p.projected)}</b></p>
      <p>{p.left > 0 ? <>Precisa de <b className="figure text-ink">{rn(kind, p.needPerDay)}</b>/dia nos {p.left} dias úteis restantes</> : "Último dia útil do mês"}</p>
      <p>{p.etaDate ? <>No ritmo atual bate a meta em <b className="figure text-ink">{fmtDay(p.etaDate)}</b></> : <b className="text-warn">No ritmo atual não bate a meta no mês</b>}</p>
    </div>
  );
}

/** Metas do mês do vendedor: uma métrica embaixo da outra (valor, barra e previsão). Métrica desligada nem aparece. */
export function SellerGoalPanel({ actual, targets, weights, bonusReais, bonusSales, monthLabel, name, hex, compact, enabled, allOff, paces }: { paces?: Record<string, SellerPace>; enabled?: SellerEnabled; allOff?: boolean; name?: string; hex?: string; compact?: boolean; actual: SellerActuals; targets: SellerTargets; weights: SellerWeights; bonusReais: number; bonusSales: number; monthLabel: string }) {
  const { each, overall } = attainment(actual, targets, weights, enabled);
  const shown = SELLER_METRICS.filter((m) => !enabled || enabled[m.key]);
  if (allOff || shown.length === 0) return <GoalsOff name={name} hex={hex} />;
  const done = overall >= 100;
  return (
    <section className={`${panelCls} ${compact ? "space-y-4 p-4" : "space-y-5 p-5 sm:p-6"} ${done ? "border-ok/60" : ""}`}>
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent"><Target size={22} aria-hidden /></span>
        <div className="min-w-0 flex-1"><h2 className="display flex items-center gap-2 text-xl">{name ? <><span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: hex }} /><span className="truncate">{name}</span></> : "Meta do mês"}</h2><p className="text-sm text-muted first-letter:uppercase">{monthLabel}</p></div>
        <div className="shrink-0 text-right"><p className="figure text-4xl font-bold leading-none">{Math.round(overall)}%</p><p className="text-xs text-muted">meta geral</p></div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full transition-[width] duration-700 ${done ? "bg-ok" : "bg-grad"}`} style={{ width: `${Math.min(100, overall)}%` }} /></div>
      <ul className="space-y-3">
        {shown.map((m) => {
          const pct = each[m.key];
          return (
            <li key={m.key} title={m.hint} className={`rounded-xl bg-sunk/40 p-4 ${pct >= 100 ? "ring-1 ring-ok/50" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{m.label}</span>
                <span className="rounded-full bg-sunk px-2 py-0.5 text-[11px] font-medium text-muted">peso {weights[m.key]}%</span>
                <b className={`figure ml-auto text-sm ${pct >= 100 ? "text-ok" : ""}`}>{Math.round(pct)}%</b>
              </div>
              <p className="figure mt-1 text-sm"><b className="text-xl">{val(m.kind, actual[m.key])}</b> <span className="text-muted">de {val(m.kind, targets[m.key])}</span></p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full transition-[width] duration-700 ${pct >= 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
              {paces?.[m.key] && <PaceLine kind={m.kind} p={paces[m.key]} />}
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-2 rounded-xl bg-sunk px-3.5 py-2.5 text-sm"><Gift size={16} className="text-accent" aria-hidden /><span className="flex-1">Bônus por venda (1ª venda de cada cliente): <b className="figure">{bonusSales}</b> {bonusSales === 1 ? "cliente" : "clientes"}</span><b className="figure inline-flex items-center gap-1 text-ok"><CircleDollarSign size={15} aria-hidden />{fmtBRL(bonusReais * 100)}</b></p>
    </section>
  );
}
