import { Gauge } from "lucide-react";
import { TeamTile } from "@/components/goal-ui";
import { METRIC_ICON } from "@/components/deals/seller-metric-icons";
import { fmtBRL } from "@/config/deals";
import { SELLER_METRICS, type SellerActuals, type SellerEnabled, type SellerTargets } from "@/config/seller-goals";

const nf = new Intl.NumberFormat("pt-BR");
const val = (kind: "count" | "money", v: number) => (kind === "money" ? fmtBRL(Math.round(v * 100)) : nf.format(Math.round(v)));

/** Total da equipe no mês: um quadro por métrica ligada (soma de quem a tem ligada) e a meta geral. Ocupam sempre toda a largura. */
export function SellerTeamTiles({ rows, monthLabel }: { rows: { actual: SellerActuals; targets: SellerTargets; enabled: SellerEnabled; overall: number }[]; monthLabel: string }) {
  const tiles = SELLER_METRICS.map((m) => {
    const on = rows.filter((r) => r.enabled[m.key]);
    const n = on.reduce((a, r) => a + r.actual[m.key], 0), qty = on.reduce((a, r) => a + r.targets[m.key], 0);
    return { m, any: on.length > 0, n, qty, pct: qty > 0 ? (n / qty) * 100 : 0 };
  }).filter((t) => t.any);
  const avg = rows.length ? rows.reduce((a, r) => a + r.overall, 0) / rows.length : 0;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))" }}>
      <TeamTile icon={<Gauge size={15} aria-hidden />} label="Geral" pct={avg} value={`${Math.round(avg)}%`} of="da meta" sub={monthLabel} />
      {tiles.map(({ m, n, qty, pct }) => { const Icon = METRIC_ICON[m.key]; return <TeamTile key={m.key} icon={<Icon size={15} aria-hidden />} label={m.label} pct={pct} value={val(m.kind, n)} of={`de ${val(m.kind, qty)}`} />; })}
    </div>
  );
}
