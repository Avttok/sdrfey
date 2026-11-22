"use client";

import { FileText, Hand, Star, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GOALS, SEGMENTS, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { HScroll } from "./h-scroll";
import { ScriptPlayer, type ScriptVars } from "./script-player";
import { GOAL_THEME, SEGMENT_ICON, tint } from "./script-theme";

/** Escolha da fase (prospecção, venda, retorno) e do tipo de cliente, em botões com ícone; depois roda o roteiro. Shuffler e página Scripts. */
export function ScriptPicker({ scripts, vars, goal, segmentHint, onNote }: { scripts: ScriptDoc[]; vars: ScriptVars; goal?: ScriptGoal; segmentHint?: string | null; onNote?: (note: string) => void }) {
  const [g, setG] = useState<ScriptGoal>(goal ?? "sdr");
  const list = useMemo(() => scripts.filter((s) => s.goal === g), [scripts, g]);
  const [id, setId] = useState<number | null>(null);
  const current = list.find((s) => s.id === id) ?? list.find((s) => s.segment === segmentHint) ?? list.find((s) => s.segment === "geral") ?? list[0];
  const chips = useRef<HTMLDivElement>(null);
  /** O modelo em uso (escolhido pelo sistema ou por você) sempre aparece na fileira. */
  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>("[aria-pressed=true]"); const box = el?.closest<HTMLElement>(".no-sb");
    if (el && box) box.scrollTo({ left: Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2), behavior: "smooth" });
  }, [current?.id]);
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
      <div ref={chips}><HScroll className="flex gap-1.5 pb-1" label="Tipo de cliente">
        {list.map((s) => {
          const Icon = SEGMENT_ICON[s.segment] ?? SEGMENT_ICON.geral; const on = s.id === current?.id; const hint = s.segment === segmentHint;
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => setId(s.id)} title={s.title}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? "border-accent bg-accent/15 text-accent" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>
              {s.mine ? <Star size={13} aria-hidden /> : <Icon size={13} aria-hidden />}{s.mine ? s.title : SEGMENTS[s.segment] ?? s.segment}{hint && <span className="rounded-full bg-ok/20 px-1.5 text-[10px] text-ok">sugerido</span>}
            </button>
          );
        })}
      </HScroll></div>
      {current && (() => {
        const why = id !== null && list.some((s) => s.id === id) ? { t: "escolhido por você", Icon: Hand } : current.segment === segmentHint ? { t: "escolhido automaticamente pelo tipo de empresa", Icon: Wand2 } : current.segment === "geral" ? { t: "script geral (tipo de empresa não identificado)", Icon: Wand2 } : { t: "primeiro da lista", Icon: Wand2 };
        return <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-sunk px-3 py-2 text-sm" aria-live="polite"><FileText size={15} aria-hidden className="text-accent" /><span className="text-muted">Script em uso:</span><b>{current.title}</b><span className="inline-flex items-center gap-1 text-xs text-muted"><why.Icon size={12} aria-hidden /> {why.t}</span></p>;
      })()}
      {current ? <ScriptPlayer script={current} vars={vars} onNote={onNote} /> : <p className="text-sm text-muted">Sem script para esta fase.</p>}
    </div>
  );
}
