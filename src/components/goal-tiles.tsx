"use client";

import { Frown, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { KIND_ICON } from "@/components/goal-icons";
import type { GoalKind } from "@/modules/settings/goals";

export type GoalTileItem = { k: GoalKind; label: string; value: number; qty: number };

export function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || to === 0) { setN(to); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / 900); setN(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

function BigRing({ pct, done }: { pct: number; done: boolean }) {
  const size = 132, r = 56, c = 2 * Math.PI * r, to = c - (Math.min(100, pct) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={66} cy={66} r={r} fill="none" strokeWidth={10} stroke="var(--sunk)" />
      <circle cx={66} cy={66} r={r} fill="none" strokeWidth={10} strokeLinecap="round" stroke={done ? "var(--ok)" : "var(--accent)"} strokeDasharray={c} className="sh-ring" style={{ "--c": c, "--to": to, strokeDashoffset: to } as React.CSSProperties} />
    </svg>
  );
}

/** Metas do dia no Shuffler: cartões centralizados com anel animado e contagem crescente. */
export function GoalTiles({ items }: { items: GoalTileItem[] }) {
  if (items.length === 0) return (
    <div className="sh-rise flex flex-col items-center gap-3 text-center text-muted" style={{ "--d": ".2s" } as React.CSSProperties}>
      <Frown size={56} strokeWidth={1.5} aria-hidden />
      <p className="text-base font-medium">Você não tem metas definidas...</p>
    </div>
  );
  return (
    <ul className="mx-auto flex flex-wrap items-stretch justify-center gap-4">
      {items.map(({ k, label, value, qty }, i) => {
        const Icon = KIND_ICON[k], pct = qty > 0 ? (value / qty) * 100 : 0, done = qty > 0 && value >= qty;
        return (
          <li key={k} className={`sh-rise flex w-44 flex-col items-center gap-3 rounded-3xl border bg-panel/75 px-4 pb-5 pt-6 shadow-lg backdrop-blur-sm sm:w-48 ${done ? "border-ok/60" : "border-line"}`} style={{ "--d": `${0.15 + i * 0.12}s` } as React.CSSProperties}>
            <span className="relative grid place-items-center">
              <BigRing pct={pct} done={done} />
              <span className="absolute flex flex-col items-center leading-none">
                {done ? <Trophy size={34} className="text-ok" aria-hidden /> : <><b className="figure text-4xl"><CountUp to={value} /></b><span className="figure mt-1 text-xs font-medium text-muted">de {qty}</span></>}
              </span>
            </span>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Icon size={15} className="text-accent" aria-hidden />{label}</p>
          </li>
        );
      })}
    </ul>
  );
}
