"use client";

import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { GOALS, SEGMENTS, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { inputCls } from "@/components/ui";
import { ScriptPlayer, type ScriptVars } from "./script-player";

/** Escolhe o script (objetivo + tipo de estabelecimento) e roda o player. Usado no Shuffler e na página Scripts. */
export function ScriptPicker({ scripts, vars, goal, segmentHint, compact }: { scripts: ScriptDoc[]; vars: ScriptVars; goal?: ScriptGoal; segmentHint?: string | null; compact?: boolean }) {
  const [g, setG] = useState<ScriptGoal>(goal ?? "sdr");
  const list = useMemo(() => scripts.filter((s) => s.goal === g), [scripts, g]);
  const [id, setId] = useState<number | null>(null);
  const current = list.find((s) => s.id === id) ?? list.find((s) => s.segment === segmentHint) ?? list.find((s) => s.segment === "geral") ?? list[0];
  if (!scripts.length) return <p className="text-sm text-muted">Nenhum script disponível ainda.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText size={18} aria-hidden className="text-accent" />
        {<select aria-label="Objetivo" className={`${inputCls} !w-auto`} value={g} onChange={(e) => { setG(e.target.value as ScriptGoal); setId(null); }}>{(Object.keys(GOALS) as ScriptGoal[]).map((k) => <option key={k} value={k}>{GOALS[k].label}</option>)}</select>}
        <select aria-label="Script" className={`${inputCls} !w-auto min-w-0 flex-1`} value={current?.id ?? ""} onChange={(e) => setId(Number(e.target.value))}>
          {list.map((s) => <option key={s.id} value={s.id}>{s.mine ? "★ " : ""}{compact ? SEGMENTS[s.segment] ?? s.segment : s.title}</option>)}
        </select>
      </div>
      {current ? <ScriptPlayer script={current} vars={vars} /> : <p className="text-sm text-muted">Sem script para este objetivo.</p>}
    </div>
  );
}
