"use client";

import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { GOALS, SEGMENTS, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { ScriptPlayer, type ScriptVars } from "./script-player";
import { GOAL_THEME, SEGMENT_ICON, tint } from "./script-theme";

/** Escolha da fase (prospecção, venda, retorno) e do tipo de cliente, em botões com ícone; depois roda o jogo. Shuffler e página Scripts. */
export function ScriptPicker({ scripts, vars, goal, segmentHint, compact }: { scripts: ScriptDoc[]; vars: ScriptVars; goal?: ScriptGoal; segmentHint?: string | null; compact?: boolean }) {
  const [g, setG] = useState<ScriptGoal>(goal ?? "sdr");
  const list = useMemo(() => scripts.filter((s) => s.goal === g), [scripts, g]);
  const [id, setId] = useState<number | null>(null);
  const current = list.find((s) => s.id === id) ?? list.find((s) => s.segment === segmentHint) ?? list.find((s) => s.segment === "geral") ?? list[0];
  if (!scripts.length) return <p className="text-sm text-muted">Nenhum script disponível ainda.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fase da ligação">
        {(Object.keys(GOALS) as ScriptGoal[]).map((k) => {
          const t = GOAL_THEME[k]; const on = g === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setG(k); setId(null); }} style={on ? { background: t.hex, borderColor: t.hex } : tint(t.hex, 8, 30)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition active:scale-95 ${on ? "text-white shadow" : "text-ink hover:brightness-95"}`}><t.Icon size={15} aria-hidden /> {t.short}</button>
          );
        })}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Tipo de cliente">
        {list.map((s) => {
          const Icon = SEGMENT_ICON[s.segment] ?? SEGMENT_ICON.geral; const on = s.id === current?.id; const hint = s.segment === segmentHint;
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => setId(s.id)} title={s.title}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? "border-accent bg-accent/15 text-accent" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>
              {s.mine ? <Star size={13} aria-hidden /> : <Icon size={13} aria-hidden />}{compact || s.mine ? (s.mine ? s.title : SEGMENTS[s.segment] ?? s.segment) : s.title}{hint && <span className="rounded-full bg-ok/20 px-1.5 text-[10px] text-ok">sugerido</span>}
            </button>
          );
        })}
      </div>
      {current ? <ScriptPlayer script={current} vars={vars} /> : <p className="text-sm text-muted">Sem script para esta fase.</p>}
    </div>
  );
}
