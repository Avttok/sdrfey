"use client";

import { Palette, X } from "lucide-react";
import { useRef } from "react";

export const DEAL_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#78716c"];

/** Paleta rápida + cor livre. `onChange(null)` tira a cor. */
export function ColorPicker({ value, onChange, disabled }: { value: string | null; onChange: (c: string | null) => void; disabled?: boolean }) {
  const custom = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Cor da negociação">
      <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted"><Palette size={13} aria-hidden /> Cor</span>
      {DEAL_COLORS.map((c) => (
        <button key={c} type="button" disabled={disabled} aria-label={`Cor ${c}`} aria-pressed={value === c} onClick={() => onChange(c)}
          className={`size-6 rounded-full border-2 transition hover:scale-110 ${value === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />
      ))}
      <button type="button" disabled={disabled} onClick={() => custom.current?.click()} aria-label="Escolher outra cor" className="size-6 rounded-full border-2 border-dashed border-line text-[10px] font-bold text-muted hover:border-accent">+</button>
      <input ref={custom} type="color" className="sr-only" tabIndex={-1} value={value ?? "#3b82f6"} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" disabled={disabled} onClick={() => onChange(null)} aria-label="Tirar a cor" className="grid size-6 place-items-center rounded-full text-muted hover:bg-sunk"><X size={14} aria-hidden /></button>}
    </div>
  );
}
