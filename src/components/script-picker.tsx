"use client";

import { ChevronDown, FileText, Hand, Star, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GOALS, SEGMENTS, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { loadScriptAction } from "@/modules/scripts/actions";
import { HScroll } from "./h-scroll";
import { ScriptPlayer, type ScriptRun, type ScriptVars } from "./script-player";
import { GOAL_THEME, SEGMENT_ICON, tint } from "./script-theme";

/** Escolha da fase (prospecção, venda, retorno) e do tipo de cliente, em botões com ícone; depois roda o roteiro. Shuffler e página Scripts. */
export function ScriptPicker({ scripts, vars, goal, segmentHint, extra, onNote, onRun }: { scripts: ScriptDoc[]; vars: ScriptVars; extra?: (nodeId: string, pick: (i: number) => void) => React.ReactNode; goal?: ScriptGoal; segmentHint?: string | null; onNote?: (note: string) => void; onRun?: (run: ScriptRun) => void }) {
  const [g, setG] = useState<ScriptGoal>(goal ?? "sdr");
  /** Scripts que chegaram sem os passos (para a tela abrir rápido) e foram buscados ao escolher. */
  const [full, setFull] = useState<Record<number, ScriptDoc>>({});
  const list = useMemo(() => scripts.filter((s) => s.goal === g).map((s) => full[s.id] ?? s), [scripts, g, full]);
  const [id, setId] = useState<number | null>(null);
  const current = list.find((s) => s.id === id) ?? list.find((s) => s.segment === segmentHint) ?? list.find((s) => s.segment === "geral") ?? list[0];
  const [failed, setFailed] = useState(false);
  const needs = current && current.nodes.length === 0 ? current.id : null;
  useEffect(() => {
    if (needs === null) return;
    let live = true; setFailed(false);
    loadScriptAction(needs).then((d) => { if (!live) return; if (d) setFull((f) => ({ ...f, [d.id]: d })); else setFailed(true); }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [needs]);
  const chips = useRef<HTMLDivElement>(null);
  /** Os tipos de cliente ficam recolhidos para o roteiro caber na tela; o script em uso sempre aparece. */
  const [types, setTypes] = useState(false);
  /** O modelo em uso (escolhido pelo sistema ou por você) sempre aparece na fileira. */
  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>("[aria-pressed=true]"); const box = el?.closest<HTMLElement>(".no-sb");
    if (el && box) box.scrollTo({ left: Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2), behavior: "smooth" });
  }, [current?.id, types]);
  if (!scripts.length) return <p className="text-sm text-muted">Nenhum script disponível ainda.</p>;
  return (
    <div className="space-y-3">
      {current && (() => {
        const why = id !== null && list.some((s) => s.id === id) ? { t: "escolhido por você", Icon: Hand } : current.segment === segmentHint ? { t: "escolhido automaticamente pelo tipo de empresa", Icon: Wand2 } : current.segment === "geral" ? { t: "script geral (tipo de empresa não identificado)", Icon: Wand2 } : { t: "primeiro da lista", Icon: Wand2 };
        return <div className="flex items-center gap-2"><p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-sunk px-3 py-2 text-sm" aria-live="polite"><FileText size={15} aria-hidden className="text-accent" /><span className="text-muted">Script em uso:</span><b>{current.title}</b><span className="inline-flex items-center gap-1 text-xs text-muted"><why.Icon size={12} aria-hidden /> {why.t}</span></p><button type="button" aria-expanded={types} onClick={() => setTypes(!types)} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold transition hover:border-accent/50">Alterar roteiro <ChevronDown size={15} aria-hidden className={`transition ${types ? "rotate-180" : ""}`} /></button></div>;
      })()}
      {types && <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fase da ligação">
        {(Object.keys(GOALS) as ScriptGoal[]).map((k) => {
          const t = GOAL_THEME[k]; const on = g === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setG(k); setId(null); }} style={on ? { background: t.hex, borderColor: t.hex } : tint(t.hex, 8, 30)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition active:scale-95 ${on ? "text-white shadow" : "text-ink hover:brightness-95"}`}><t.Icon size={15} aria-hidden /> {t.short}</button>
          );
        })}
      </div>}
      {types && <div ref={chips}><HScroll className="flex gap-1.5 pb-1" label="Tipo de cliente">
        {list.map((s) => {
          const Icon = SEGMENT_ICON[s.segment] ?? SEGMENT_ICON.geral; const on = s.id === current?.id; const hint = s.segment === segmentHint;
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => setId(s.id)} title={s.title}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? "border-accent bg-accent/15 text-accent" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>
              {s.mine ? <Star size={13} aria-hidden /> : <Icon size={13} aria-hidden />}{s.mine ? s.title : SEGMENTS[s.segment] ?? s.segment}{hint && <span className="rounded-full bg-ok/20 px-1.5 text-[10px] text-ok">sugerido</span>}
            </button>
          );
        })}
      </HScroll></div>}
      {current && needs !== null ? <p className="rounded-xl bg-sunk px-3 py-6 text-center text-sm text-muted" role="status">{failed ? "Não consegui carregar este roteiro. Escolha outro ou tente de novo." : "Carregando o roteiro…"}</p> : current ? <ScriptPlayer script={current} vars={vars} extra={extra} onNote={onNote} onRun={onRun} /> : <p className="text-sm text-muted">Sem script para esta fase.</p>}
    </div>
  );
}
