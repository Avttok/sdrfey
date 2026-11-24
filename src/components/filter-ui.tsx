"use client";

import { Check } from "lucide-react";

export type Tri = "" | "sim" | "nao";

/** Grupo de um painel de filtros: título curto, dica opcional e os controles embaixo. */
export function FilterGroup({ title, hint, children, span = "" }: { title: string; hint?: string; children: React.ReactNode; span?: string }) {
  return <fieldset className={`min-w-0 space-y-2 ${span}`}><legend className="text-sm font-semibold">{title}{hint && <span className="ml-1.5 text-xs font-normal text-muted">{hint}</span>}</legend>{children}</fieldset>;
}

/** Botão-pílula de liga/desliga (marca ✓ quando ligado). */
export function Pill({ on, onClick, children, color, count }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string; count?: number }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={on && color ? { background: color, borderColor: color } : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${on ? (color ? "text-white shadow-sm" : "border-accent bg-accent/12 text-accent") : "border-line bg-panel text-muted hover:text-ink"}`}>
      {on && <Check size={13} aria-hidden />}{children}
      {count !== undefined && <span className={`figure rounded-full px-1.5 text-xs ${on ? "bg-white/25" : "bg-sunk"}`}>{count}</span>}
    </button>
  );
}

/** Escolha entre três estados: tudo / tem / não tem. */
export function Tri3({ label, v, set, labels = ["Tudo", "Tem", "Não tem"] }: { label: string; v: Tri; set: (t: Tri) => void; labels?: [string, string, string] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center justify-between gap-3 rounded-xl bg-sunk/60 px-3 py-2">
      <span className="text-sm">{label}</span>
      <span className="flex gap-1 rounded-full border border-line bg-panel p-0.5">
        {(["", "sim", "nao"] as const).map((k, i) => <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => set(k)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${v === k ? "bg-grad text-on-accent" : "text-muted hover:text-ink"}`}>{labels[i]}</button>)}
      </span>
    </div>
  );
}

/** Seletor segmentado (uma opção por vez), usado para ordenar, trocar de visão etc. */
export function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, React.ReactNode, React.ReactNode?])[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="no-sb inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1">
      {options.map(([k, l, icon]) => <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${value === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:bg-sunk hover:text-ink"}`}>{icon}{l}</button>)}
    </div>
  );
}
