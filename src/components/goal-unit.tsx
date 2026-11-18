"use client";

import { useState } from "react";
import { inputCls } from "@/components/ui";

export type Unit = "dia" | "mes";

/** Troca entre editar a meta por dia útil ou por mês. A meta guardada não muda de tipo; só a conta de tela. */
export function UnitToggle({ unit, onChange, wd, monthLabel }: { unit: Unit; onChange: (u: Unit) => void; wd: number; monthLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Editar metas por" className="inline-flex rounded-xl border border-line bg-panel p-1">
        {([["dia", "Por dia"], ["mes", "Por mês"]] as const).map(([k, t]) => (
          <button key={k} type="button" role="radio" aria-checked={unit === k} onClick={() => onChange(k)}
            className={`min-h-9 rounded-lg px-4 text-sm font-medium transition-colors ${unit === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      <p className="text-xs text-muted">O outro valor é calculado com os <b className="text-ink">{wd} dias úteis</b> de {monthLabel}.</p>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Campo numérico que mostra o valor na unidade escolhida e guarda na unidade original.
 *  Enquanto a pessoa digita, mostra o texto dela (sem “pular” por arredondamento). */
export function UnitInput({ stored, toView, fromView, onCommit, placeholder, disabled, className = "", ariaLabel, title }: {
  stored: number | "" | null; toView: (n: number) => number; fromView: (n: number) => number; onCommit: (v: number | null) => void;
  placeholder?: number; disabled?: boolean; className?: string; ariaLabel: string; title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (stored === "" || stored === null ? "" : String(toView(stored)));
  return (
    <input type="number" min={0} step="any" inputMode="decimal" aria-label={ariaLabel} title={title} disabled={disabled} className={`${inputCls} ${className}`}
      placeholder={placeholder === undefined ? undefined : fmt(toView(placeholder))} value={shown}
      onChange={(e) => { setDraft(e.target.value); onCommit(e.target.value === "" ? null : fromView(Math.max(0, Number(e.target.value)))); }}
      onBlur={() => setDraft(null)} />
  );
}
