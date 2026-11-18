"use client";

import { Trophy } from "lucide-react";
import { panelCls } from "@/components/ui";
import { KIND_ICON, type GoalPerson } from "@/components/goals-form";
import { SDR_KINDS, type GoalKind } from "@/modules/settings/goals";

type Kind = GoalKind;
const KS = SDR_KINDS.map((d) => d.k) as Kind[];
type Global = Record<Kind, { on: boolean; qty: number }>;

function Ring({ pct, size = 64, children }: { pct: number; size?: number; children?: React.ReactNode }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, done = pct >= 100;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} stroke="var(--sunk)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} strokeLinecap="round" stroke={done ? "var(--ok)" : "var(--accent)"} strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} style={{ transition: "stroke-dashoffset .7s" }} />
      </svg>
      <span className="figure absolute text-sm font-bold">{children ?? `${Math.round(pct)}%`}</span>
    </span>
  );
}

/** Resumo do dia: o total da equipe e um cartão por pessoa, com anéis de progresso de atendidos e agendados. */
export function SdrOverview({ global, people, showTeam }: { global: Global; people: GoalPerson[]; showTeam: boolean }) {
  const cfg = people.map((p) => KS.map((k) => {
    const on = !p.off && (p.own[k].on ?? global[k].on), qty = p.own[k].qty ?? global[k].qty;
    return { k, on, qty, n: p.today[k], pct: on && qty ? (p.today[k] / qty) * 100 : 0 };
  }));
  const totals = KS.map((k, i) => {
    const rows = cfg.map((c) => c[i]).filter((c) => c.on && c.qty);
    const n = rows.reduce((a, c) => a + c.n, 0), qty = rows.reduce((a, c) => a + c.qty, 0);
    return { k, n, qty, any: rows.length > 0, pct: qty ? (n / qty) * 100 : 0 };
  }).filter((t) => t.any);
  const META = Object.fromEntries(SDR_KINDS.map((d) => [d.k, { label: d.today, short: d.label, Icon: KIND_ICON[d.k] }])) as Record<Kind, { label: string; short: string; Icon: typeof KIND_ICON.attended }>;
  return (
    <div className="space-y-4">
      {showTeam && totals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {totals.map((t) => { const M = META[t.k]; return (
            <section key={t.k} className={`${panelCls} flex items-center gap-4 p-5`}>
              <Ring pct={t.pct} size={72} />
              <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm text-muted"><M.Icon size={15} aria-hidden /> {M.label} · equipe</p>
                <p className="figure mt-1 whitespace-nowrap text-3xl font-bold leading-none">{t.n}<span className="text-lg font-medium text-muted"> / {t.qty}</span></p>
                {t.pct >= 100 && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-ok"><Trophy size={12} aria-hidden /> Meta da equipe batida</p>}</div>
            </section>
          ); })}
        </div>
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p, i) => (
          <li key={p.id} className={`${panelCls} space-y-4 p-4`}>
            <p className="flex items-center gap-2 font-semibold"><span aria-hidden className="size-3 rounded-full" style={{ background: p.hex }} /><span className="truncate">{p.name}</span></p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 2xl:grid-cols-4">
              {cfg[i].map((c) => { const M = META[c.k]; return (
                <div key={c.k} className={`flex flex-col items-center gap-1.5 rounded-xl bg-sunk/40 px-2 py-3 text-center ${c.on ? "" : "opacity-50"}`}>
                  {c.on ? <Ring pct={c.pct} size={64} /> : <span className="grid size-16 place-items-center text-xs text-muted">Desligada</span>}
                  <p className="text-xs font-medium"><M.Icon size={12} className="mr-1 inline" aria-hidden />{M.short}</p>
                  <p className="figure whitespace-nowrap text-xs text-muted">{c.on ? <><b className="text-ink">{c.n}</b> de {c.qty}</> : "—"}</p>
                </div>
              ); })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
