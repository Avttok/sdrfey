import { Gauge } from "lucide-react";
import { Ring } from "@/components/goals-overview";
import { panelCls } from "@/components/ui";
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
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11rem), 1fr))" }}>
      <section className={`${panelCls} flex items-center gap-3 p-4`}>
        <Ring pct={avg} size={60} />
        <div className="min-w-0"><p className="flex items-center gap-1 text-sm text-muted"><Gauge size={14} aria-hidden /> Geral</p><p className="mt-0.5 text-xs text-muted first-letter:uppercase">{monthLabel}</p></div>
      </section>
      {tiles.map(({ m, n, qty, pct }) => (
        <section key={m.key} className={`${panelCls} flex items-center gap-3 p-4`}>
          <Ring pct={pct} size={60} />
          <div className="min-w-0"><p className="text-sm text-muted">{m.label}</p><p className="figure mt-1 text-lg font-bold leading-tight">{val(m.kind, n)}</p><p className="figure text-xs text-muted">de {val(m.kind, qty)}</p></div>
        </section>
      ))}
    </div>
  );
}
