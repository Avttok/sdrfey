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

const HEX: Record<string, string> = { attended: "#6366f1", scheduled: "#f59e0b", calls: "#10b981", converted: "#ec4899", shuffle: "#6366f1", handshake: "#f59e0b", inactive: "#64748b" };
const tint = (hex: string, a: number, b: number) => `linear-gradient(145deg, color-mix(in srgb, ${hex} ${a}%, var(--panel)), color-mix(in srgb, ${hex} ${b}%, var(--panel)) 70%)`;

/**
 * Metas do dia no estilo dos objetivos do roteiro: cartas em degradê da cor de cada meta, ícone gigante de marca d'água,
 * brilho no canto, número que sobe contando, barra de progresso e, batida a meta, a carta fica verde com troféu.
 */
function GoalCard({ icon, label, value, qty, plain, i }: Pill & { i: number }) {
  const Icon = icon in EXTRA ? EXTRA[icon as keyof typeof EXTRA] : KIND_ICON[icon as GoalKind];
  const hasGoal = !!qty && qty > 0 && !plain, pct = hasGoal ? Math.min(100, (value / qty!) * 100) : 0, done = hasGoal && value >= qty!;
  const hex = done ? "#22c55e" : HEX[icon] ?? "#6366f1";
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 150 + i * 90); return () => clearTimeout(t); }, [i]);
  return (
    <li className="sh-rise group relative flex min-h-[10.5rem] flex-col justify-between gap-3 overflow-hidden rounded-3xl border-2 p-4 text-left transition duration-200 hover:-translate-y-1 [&:last-child:nth-child(odd)]:col-span-2"
      style={{ "--d": `${0.2 + i * 0.1}s`, background: tint(hex, 22, 6), borderColor: `color-mix(in srgb, ${hex} 55%, transparent)`, boxShadow: done ? `0 10px 30px -14px ${hex}` : undefined } as React.CSSProperties}>
      <Icon aria-hidden size={110} strokeWidth={1.4} className="pointer-events-none absolute -bottom-5 -right-3 -rotate-12 opacity-[.13] transition duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ color: hex }} />
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-30 blur-2xl" style={{ background: hex }} />
      <div className="relative flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))` }}>{done ? <Trophy size={22} aria-hidden /> : <Icon size={22} aria-hidden />}</span>
        <span className="min-w-0 text-sm font-bold leading-tight">{label}</span>
      </div>
      <div className="relative">
        <span className="figure leading-none"><b className="text-4xl font-extrabold"><CountUp to={value} /></b>{hasGoal && <span className="ml-1.5 text-sm font-semibold text-muted">/ {qty}</span>}</span>
        {hasGoal ? (
          <>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sunk/80" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: on ? `${pct}%` : "0%", background: `linear-gradient(90deg, ${hex}, color-mix(in srgb, ${hex} 60%, #fff))` }} /></div>
            <p className={`mt-1.5 text-xs ${done ? "font-bold text-ok" : "text-muted"}`}>{done ? "Meta batida!" : `faltam ${qty! - value}`}</p>
          </>
        ) : null}
      </div>
    </li>
  );
}

export function GoalPills({ items }: { items: Pill[] }) {
  const goals = items.filter((i) => i.qty && i.qty > 0);
  const total = goals.length ? Math.round((goals.reduce((a, g) => a + Math.min(1, g.value / g.qty!), 0) / goals.length) * 100) : null;
  const R = 22, C = 2 * Math.PI * R;
  return (
    <div className="flex w-full max-w-lg flex-col items-stretch gap-4">
      {total !== null && (
        <div className="sh-rise relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 p-4 text-white shadow-xl" style={{ "--d": ".1s", background: total >= 100 ? "linear-gradient(135deg, #22c55e, color-mix(in srgb, #22c55e 62%, #000))" : "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 62%, #000))", borderColor: "transparent" } as React.CSSProperties}>
          <Trophy aria-hidden size={120} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-4 -rotate-12 opacity-[.15]" />
          <span className="relative grid size-16 shrink-0 place-items-center">
            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden><circle cx="28" cy="28" r={R} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="6" /><circle cx="28" cy="28" r={R} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(Math.min(100, total) / 100) * C} ${C}`} className="transition-[stroke-dasharray] duration-1000" /></svg>
            <span className="figure relative text-sm font-extrabold"><CountUp to={total} />%</span>
          </span>
          <div className="relative min-w-0"><p className="text-xs font-bold uppercase tracking-wider opacity-90">Meta do dia</p><p className="text-lg font-extrabold leading-tight">{total >= 100 ? "Todas as metas batidas!" : total >= 50 ? "Mais da metade, continue!" : "Bora começar!"}</p></div>
        </div>
      )}
      <ul className="grid w-full grid-cols-2 gap-3">
        {items.map((it, i) => <GoalCard key={it.label} {...it} i={i} />)}
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
