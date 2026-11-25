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
 * Metas do dia como medalhas: um anel que se preenche (com brilho) em volta do ícone, o número sobe contando
 * e, batida a meta, o anel fica verde com troféu. Sem caixas por trás, no estilo das conquistas.
 */
function Ring({ pct, done, plain, children }: { pct: number; done: boolean; plain: boolean; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 120); return () => clearTimeout(t); }, []);
  const R = 46, C = 2 * Math.PI * R;
  const id = `gr${Math.round(pct)}${done ? "d" : ""}${plain ? "p" : ""}`;
  return (
    <span className={`relative grid size-28 place-items-center ${done ? "goal-done" : ""}`}>
      <svg viewBox="0 0 110 110" className="absolute inset-0 -rotate-90" aria-hidden>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={done ? "#34d399" : "var(--accent)"} /><stop offset="100%" stopColor={done ? "#16a34a" : "color-mix(in srgb, var(--accent) 55%, #fff)"} /></linearGradient></defs>
        <circle cx="55" cy="55" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-line" opacity=".35" />
        {!plain && <circle cx="55" cy="55" r={R} fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={on ? C * (1 - pct / 100) : C} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 55%, transparent))" }} />}
      </svg>
      <span className={`relative grid size-[4.6rem] place-items-center rounded-full shadow-lg ${done ? "bg-ok text-white" : "bg-grad text-on-accent"}`}>{children}</span>
    </span>
  );
}

export function GoalPills({ items }: { items: Pill[] }) {
  const goals = items.filter((i) => i.qty && i.qty > 0);
  const total = goals.length ? Math.round((goals.reduce((a, g) => a + Math.min(1, g.value / g.qty!), 0) / goals.length) * 100) : null;
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      {total !== null && (
        <p className="sh-rise flex items-center gap-2 text-sm font-semibold text-muted" style={{ "--d": ".1s" } as React.CSSProperties}>
          Meta do dia <span className="figure rounded-full bg-grad px-3 py-0.5 text-base font-bold text-on-accent"><CountUp to={total} />%</span>
        </p>
      )}
      <ul className="grid w-full grid-cols-2 justify-items-center gap-x-4 gap-y-6">
        {items.map(({ icon, label, value, qty, plain }, i) => {
          const Icon = icon in EXTRA ? EXTRA[icon as keyof typeof EXTRA] : KIND_ICON[icon as GoalKind];
          const hasGoal = !!qty && qty > 0 && !plain, pct = hasGoal ? Math.min(100, (value / qty!) * 100) : 0, done = hasGoal && value >= qty!;
          return (
            <li key={label} className="sh-rise flex w-full max-w-[9rem] flex-col items-center gap-2 text-center [&:last-child:nth-child(odd)]:col-span-2" style={{ "--d": `${0.2 + i * 0.12}s` } as React.CSSProperties}>
              <Ring pct={pct} done={done} plain={!hasGoal}>{done ? <Trophy size={30} aria-hidden /> : <Icon size={30} aria-hidden />}</Ring>
              <span className="figure leading-none"><b className="text-3xl"><CountUp to={value} /></b>{hasGoal && <span className="ml-1 text-sm font-medium text-muted">/ {qty}</span>}</span>
              <span className="text-sm font-semibold leading-tight">{label}</span>
              {hasGoal && <span className={`text-xs ${done ? "font-bold text-ok" : "text-muted"}`}>{done ? "Meta batida!" : `faltam ${qty! - value}`}</span>}
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
