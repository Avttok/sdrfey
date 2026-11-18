import { Frown, Trophy } from "lucide-react";
import { KIND_ICON } from "@/components/goal-icons";
import { Ring } from "@/components/goals-overview";
import type { GoalKind } from "@/modules/settings/goals";

export type GoalTileItem = { k: GoalKind; label: string; value: number; qty: number };

/** Metas do dia na tela inicial do Shuffler: um quadro por meta ligada, com anel de progresso. */
export function GoalTiles({ items }: { items: GoalTileItem[] }) {
  if (items.length === 0) return (
    <div className="flex flex-col items-center gap-3 text-center text-muted">
      <Frown size={56} strokeWidth={1.5} aria-hidden />
      <p className="text-base font-medium">Você não tem metas definidas...</p>
    </div>
  );
  return (
    <ul className={`grid w-full gap-3 ${items.length === 1 ? "max-w-[15rem]" : "max-w-md grid-cols-2"} mx-auto`}>
      {items.map(({ k, label, value, qty }) => {
        const Icon = KIND_ICON[k], pct = qty > 0 ? (value / qty) * 100 : 0, done = qty > 0 && value >= qty;
        return (
          <li key={k} className={`flex flex-col items-center gap-2 rounded-2xl border bg-panel/70 p-4 text-center backdrop-blur-sm ${done ? "border-ok/60" : "border-line"}`}>
            <Ring pct={pct} size={76}>{done ? <Trophy size={22} className="text-ok" aria-hidden /> : undefined}</Ring>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Icon size={14} className="text-accent" aria-hidden />{label}</p>
            <p className="figure text-sm"><b className="text-lg">{value}</b><span className="text-muted"> / {qty}</span></p>
          </li>
        );
      })}
    </ul>
  );
}
