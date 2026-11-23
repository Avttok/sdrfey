import { CircleDollarSign, Gift } from "lucide-react";
import { GoalCard, PersonHead } from "@/components/goal-ui";
import { METRIC_ICON } from "@/components/deals/seller-metric-icons";
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
  if (p.hit) return <p className="mt-3 text-xs font-semibold text-ok">Meta batida no mês.</p>;
  const cell = (t: string, v: string, tone = "") => <div className="min-w-0 rounded-lg bg-panel/70 px-2.5 py-2"><p className="text-[11px] text-muted">{t}</p><p className={`figure break-words text-sm font-bold ${tone}`}>{v}</p></div>;
  return (
    <div className="mt-3 space-y-2 text-xs text-muted">
      <div className="grid grid-cols-3 gap-2">
        {cell("Ritmo", `${rn(kind, p.perDay)}/dia útil`)}
        {cell("Projeção do mês", rn(kind, p.projected), p.onTrack ? "text-ok" : "text-warn")}
        {cell(p.left > 0 ? `Precisa (${p.left} dias úteis)` : "Último dia útil", p.left > 0 ? `${rn(kind, p.needPerDay)}/dia` : "—")}
      </div>
      <p>{p.etaDate ? <>No ritmo atual bate a meta em <b className="figure text-ink">{fmtDay(p.etaDate)}</b></> : <b className="text-warn">No ritmo atual não bate a meta no mês</b>}</p>
    </div>
  );
}

/** Metas do mês do vendedor: uma métrica embaixo da outra (valor, barra e previsão). Métrica desligada nem aparece. */
export function SellerGoalPanel({ actual, targets, weights, bonusReais, bonusSales, monthLabel, name, hex, compact, wide, enabled, allOff, paces, pos }: { pos?: number; wide?: boolean; paces?: Record<string, SellerPace>; enabled?: SellerEnabled; allOff?: boolean; name?: string; hex?: string; compact?: boolean; actual: SellerActuals; targets: SellerTargets; weights: SellerWeights; bonusReais: number; bonusSales: number; monthLabel: string }) {
  const { each, overall } = attainment(actual, targets, weights, enabled);
  const shown = SELLER_METRICS.filter((m) => !enabled || enabled[m.key]);
  if (allOff || shown.length === 0) return <GoalsOff name={name} hex={hex} />;
  const done = overall >= 100;
  return (
    <section className={`${panelCls} ${compact ? "space-y-4 p-4" : "space-y-5 p-5 sm:p-6"} ${done ? "border-ok/60" : ""}`}>
      <PersonHead name={name ?? "Meta do mês"} hex={name ? hex : undefined} pct={overall} pos={pos} sub={monthLabel} />
      <ul className={wide ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
        {shown.map((m) => {
          const pct = each[m.key], Icon = METRIC_ICON[m.key];
          return (
            <GoalCard key={m.key} icon={<Icon size={17} aria-hidden />} label={m.label} tag={`peso ${weights[m.key]}%`} pct={pct} done={pct >= 100} value={val(m.kind, actual[m.key])} of={`de ${val(m.kind, targets[m.key])}`}>
              {paces?.[m.key] && <PaceLine kind={m.kind} p={paces[m.key]} />}
            </GoalCard>
          );
        })}
      </ul>
      <p className="flex items-center gap-2 rounded-xl bg-sunk px-3.5 py-2.5 text-sm"><Gift size={16} className="text-accent" aria-hidden /><span className="flex-1">Bônus por venda (1ª venda de cada cliente): <b className="figure">{bonusSales}</b> {bonusSales === 1 ? "cliente" : "clientes"}</span><b className="figure inline-flex items-center gap-1 text-ok"><CircleDollarSign size={15} aria-hidden />{fmtBRL(bonusReais * 100)}</b></p>
    </section>
  );
}
