"use client";

import { Frown, Handshake, Shuffle, Trophy, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { KIND_ICON } from "@/components/goal-icons";
import type { GoalKind } from "@/modules/settings/goals";

export type GoalTileItem = { k: GoalKind; label: string; value: number; qty: number };

export function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || to === 0) { setN(to); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1000); setN(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

const EXTRA = { shuffle: Shuffle, handshake: Handshake, inactive: UserX } as const;
export type Pill = { icon: GoalKind | keyof typeof EXTRA; label: string; value: number; qty?: number; plain?: boolean };

/**
 * Metas do dia como "pílulas de progresso": uma barra larga por meta, o preenchimento cresce com brilho
 * e o número sobe contando. Sem meta (qty) vira só um contador. Tudo centralizado.
 */
export function GoalPills({ items }: { items: Pill[] }) {
  const goals = items.filter((i) => i.qty && i.qty > 0);
  const total = goals.length ? Math.round((goals.reduce((a, g) => a + Math.min(1, g.value / g.qty!), 0) / goals.length) * 100) : null;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
      {total !== null && (
        <p className="sh-rise flex items-center gap-2 text-sm font-semibold text-muted" style={{ "--d": ".1s" } as React.CSSProperties}>
          Meta do dia <span className="figure rounded-full bg-grad px-3 py-0.5 text-base font-bold text-on-accent"><CountUp to={total} />%</span>
        </p>
      )}
      <ul className="flex w-full flex-col gap-3">
        {items.map(({ icon, label, value, qty, plain }, i) => {
          const Icon = icon in EXTRA ? EXTRA[icon as keyof typeof EXTRA] : KIND_ICON[icon as GoalKind];
          const hasGoal = !!qty && qty > 0 && !plain, pct = hasGoal ? Math.min(100, (value / qty!) * 100) : 0, done = hasGoal && value >= qty!;
          return (
            <li key={label} className="sh-rise" style={{ "--d": `${0.2 + i * 0.1}s` } as React.CSSProperties}>
              <div className={`relative overflow-hidden rounded-2xl border bg-panel/80 shadow-lg backdrop-blur-sm ${done ? "border-ok/60" : "border-line"}`}>
                {hasGoal && <span aria-hidden className={`sh-fill absolute inset-y-0 left-0 ${done ? "bg-ok/25" : "bg-accent/20"}`} style={{ "--w": `${pct}%` } as React.CSSProperties} />}
                <div className="relative flex items-center gap-3 px-4 py-3.5">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${done ? "bg-ok text-white" : "bg-grad text-on-accent"} shadow-md`}>{done ? <Trophy size={20} aria-hidden /> : <Icon size={20} aria-hidden />}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold">{label}</span>
                    {hasGoal && <span className="block text-xs text-muted">{done ? "Meta batida!" : `faltam ${qty! - value}`}</span>}
                  </span>
                  <span className="figure text-right leading-none"><b className="text-3xl"><CountUp to={value} /></b>{hasGoal && <span className="ml-1 text-sm font-medium text-muted">/ {qty}</span>}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GoalTiles({ items }: { items: GoalTileItem[] }) {
  if (items.length === 0) return (
    <div className="sh-rise flex flex-col items-center gap-3 text-center text-muted" style={{ "--d": ".2s" } as React.CSSProperties}>
      <Frown size={56} strokeWidth={1.5} aria-hidden />
      <p className="text-base font-medium">Você não tem metas definidas...</p>
    </div>
  );
  return <GoalPills items={items.map((g) => ({ icon: g.k, label: g.label, value: g.value, qty: g.qty }))} />;
}
