import { CircleDollarSign, Gift, Target } from "lucide-react";
import { panelCls } from "@/components/ui";
import { fmtBRL } from "@/config/deals";
import { attainment, SELLER_METRICS, type SellerActuals, type SellerTargets, type SellerWeights } from "@/config/seller-goals";

const nf = new Intl.NumberFormat("pt-BR");
const val = (kind: "count" | "money", v: number) => (kind === "money" ? fmtBRL(Math.round(v * 100)) : nf.format(v));

/** Metas do mês do vendedor: uma barra por métrica, o peso de cada uma e a meta geral ponderada. */
export function SellerGoalPanel({ actual, targets, weights, bonusReais, bonusSales, monthLabel }: { actual: SellerActuals; targets: SellerTargets; weights: SellerWeights; bonusReais: number; bonusSales: number; monthLabel: string }) {
  const { each, overall } = attainment(actual, targets, weights);
  const done = overall >= 100;
  return (
    <section className={`${panelCls} space-y-5 p-5 sm:p-6 ${done ? "border-ok/60" : ""}`}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-grad-soft text-accent"><Target size={22} aria-hidden /></span>
        <div className="min-w-0 flex-1"><h2 className="display text-xl">Meta do mês</h2><p className="text-sm text-muted first-letter:uppercase">{monthLabel}</p></div>
        <div className="text-right"><p className="figure text-4xl font-bold leading-none">{Math.round(overall)}%</p><p className="text-xs text-muted">meta geral (pesos)</p></div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full transition-[width] duration-700 ${done ? "bg-ok" : "bg-grad"}`} style={{ width: `${Math.min(100, overall)}%` }} /></div>
      <ul className="space-y-4">
        {SELLER_METRICS.map((m) => {
          const pct = each[m.key];
          return (
            <li key={m.key} title={m.hint}>
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="font-semibold">{m.label}</span>
                <span className="rounded-full bg-sunk px-2 py-0.5 text-[11px] font-medium text-muted">peso {weights[m.key]}%</span>
                <span className="figure ml-auto text-xs"><b className="text-sm">{val(m.kind, actual[m.key])}</b> <span className="text-muted">de {val(m.kind, targets[m.key])}</span></span>
                <b className={`figure w-12 text-right ${pct >= 100 ? "text-ok" : ""}`}>{Math.round(pct)}%</b>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full transition-[width] duration-700 ${pct >= 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-2 rounded-xl bg-sunk px-3.5 py-2.5 text-sm"><Gift size={16} className="text-accent" aria-hidden /><span className="flex-1">Bônus por venda (1ª venda de cada cliente): <b className="figure">{bonusSales}</b> {bonusSales === 1 ? "cliente" : "clientes"}</span><b className="figure inline-flex items-center gap-1 text-ok"><CircleDollarSign size={15} aria-hidden />{fmtBRL(bonusReais * 100)}</b></p>
    </section>
  );
}
