"use client";

import type { FactsApi } from "@/components/lead-facts";
import { BadgeCheck, CalendarCheck, ChevronDown, ChevronRight, ClipboardCheck, FileText, Hand, Heart, MapPin, PhoneCall, RefreshCw, Star, Target, Wand2, Handshake } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GOALS, SEGMENTS, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { OBJECTIVES, objectivesFor, suggestObjective, type ObjectiveArea, type ObjectiveId } from "@/config/objectives";
import { loadScriptAction } from "@/modules/scripts/actions";
import { HScroll } from "./h-scroll";
import { BannerRain } from "./banner-rain";
import { ScriptPlayer, type ScriptRun, type ScriptVars } from "./script-player";
import { GOAL_THEME, SEGMENT_ICON, tint } from "./script-theme";

/** Escolha da fase (prospecção, venda, retorno) e do tipo de cliente, em botões com ícone; depois roda o roteiro. Shuffler e página Scripts. */
const OBJ_ICON: Record<ObjectiveId, typeof Target> = { agendar: CalendarCheck, qualificar: BadgeCheck, dados: ClipboardCheck, visita: MapPin, cotacao: FileText, fechar: Handshake, retorno: PhoneCall, fidelizar: Heart, reativar: RefreshCw };

export function ScriptPicker({ hideNoteBox, facts, scripts, vars, goal, segmentHint, extra, onNote, onRun, onStep, endExtra, area, onRename, savedPerson }: { hideNoteBox?: boolean; /** Com a área (SDR ou Vendas), a ligação começa por "Escolha seu objetivo". */ area?: ObjectiveArea; onRename?: (name: string, alsoSaved: boolean) => void; savedPerson?: boolean; facts?: FactsApi; onStep?: (nodeId: string, path: string[]) => void; endExtra?: (ctx: { runId: string }) => React.ReactNode; scripts: ScriptDoc[]; vars: ScriptVars; extra?: (nodeId: string, pick: (i: number) => void) => React.ReactNode; goal?: ScriptGoal; segmentHint?: string | null; onNote?: (note: string) => void; onRun?: (run: ScriptRun) => void }) {
  const [g, setG] = useState<ScriptGoal>(goal ?? "sdr");
  /** Objetivo da ligação, escolhido antes de começar. Sem a área, o seletor não aparece e vale a categoria de sempre. */
  const [obj, setObj] = useState<ObjectiveId | null>(null);
  const choose = (k: ObjectiveId) => { setObj(k); setG(OBJECTIVES[k].goal); setId(null); setCarry(null); };
  useEffect(() => { if (goal) setG(goal); }, [goal]); // outro lead pode pedir outra categoria
  /** Scripts que chegaram sem os passos (para a tela abrir rápido) e foram buscados ao escolher. */
  const [full, setFull] = useState<Record<number, ScriptDoc>>({});
  const list = useMemo(() => scripts.filter((s) => s.goal === g).map((s) => full[s.id] ?? s), [scripts, g, full]);
  const [id, setId] = useState<number | null>(null);
  /** Ao trocar de fase, o tipo de cliente acompanha: Prospecção · Auto center vira Venda · Auto center. */
  const [carry, setCarry] = useState<string | null>(null);
  const current = list.find((s) => s.id === id) ?? (carry ? list.find((s) => s.segment === carry) : undefined) ?? list.find((s) => s.segment === segmentHint) ?? list.find((s) => s.segment === "geral") ?? list[0];
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
  if (area && !obj) {
    const sug = suggestObjective(goal ?? (area === "vendas" ? "vendas" : "sdr"));
    return (
      <div className="space-y-3" role="group" aria-label="Escolha seu objetivo">
        <div><p className="flex items-center gap-2 text-lg font-extrabold"><Target size={20} aria-hidden className="text-accent" /> Escolha seu objetivo</p><p className="text-sm text-muted">O roteiro é montado para chegar lá. Dá para trocar durante a ligação.</p></div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-2.5">
          {[...objectivesFor(area)].sort((x, y) => Number(y === sug) - Number(x === sug)).map((k) => {
            const d = OBJECTIVES[k]; const Icon = OBJ_ICON[k]; const top = k === sug;
            if (top) return (
              <button key={k} type="button" onClick={() => choose(k)} style={{ background: `linear-gradient(135deg, ${d.hex}, color-mix(in srgb, ${d.hex} 62%, #000))`, boxShadow: `0 10px 30px -10px ${d.hex}` }} className="group relative col-span-full flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-white/30 px-5 py-5 text-left text-white transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.99]">
                <BannerRain roles={["seller", "user"]} count={18} />
                <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-white/25 shadow-inner"><Icon size={32} aria-hidden /></span>
                <span className="relative min-w-0 flex-1">
                  <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: d.hex }}><Star size={12} aria-hidden /> Recomendado para este lead</span>
                  <span className="block text-2xl font-extrabold leading-tight">{d.label}</span><span className="mt-1 block text-sm opacity-95">{d.hint}</span>
                </span>
              </button>
            );
            return (
              <button key={k} type="button" onClick={() => choose(k)} style={tint(d.hex, 9, 40)} className="group flex items-start gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow" style={{ background: d.hex }}><Icon size={22} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{d.label}</span><span className="mt-0.5 block text-xs text-muted">{d.hint}</span></span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {current && (() => {
        const why = id !== null && list.some((s) => s.id === id) ? { t: "escolhido por você", Icon: Hand } : carry && current.segment === carry ? { t: "mesmo tipo de cliente da fase anterior", Icon: Wand2 } : current.segment === segmentHint ? { t: "escolhido automaticamente pelo tipo de empresa", Icon: Wand2 } : current.segment === "geral" ? { t: "script geral (tipo de empresa não identificado)", Icon: Wand2 } : { t: "primeiro da lista", Icon: Wand2 };
        return <div className="flex items-center gap-2">{obj && <button type="button" onClick={() => setObj(null)} title="Trocar o objetivo da ligação" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-bold transition hover:brightness-95" style={tint(OBJECTIVES[obj].hex, 12, 45)}>{(() => { const I = OBJ_ICON[obj]; return <I size={15} aria-hidden style={{ color: OBJECTIVES[obj].hex }} />; })()} {OBJECTIVES[obj].label}</button>}<p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-sunk px-3 py-2 text-sm" aria-live="polite"><FileText size={15} aria-hidden className="text-accent" /><span className="text-muted">Script em uso:</span><b>{current.title}</b><span className="inline-flex items-center gap-1 text-xs text-muted"><why.Icon size={12} aria-hidden /> {why.t}</span></p><button type="button" aria-expanded={types} onClick={() => setTypes(!types)} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold transition hover:border-accent/50">Alterar roteiro <ChevronDown size={15} aria-hidden className={`transition ${types ? "rotate-180" : ""}`} /></button></div>;
      })()}
      {types && !area && <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fase da ligação">
        {(Object.keys(GOALS) as ScriptGoal[]).map((k) => {
          const t = GOAL_THEME[k]; const on = g === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { if (k === g) return; setCarry(current?.segment ?? null); setG(k); setId(null); }} style={on ? { background: t.hex, borderColor: t.hex } : tint(t.hex, 8, 30)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition active:scale-95 ${on ? "text-white shadow" : "text-ink hover:brightness-95"}`}><t.Icon size={15} aria-hidden /> {t.short}</button>
          );
        })}
      </div>}
      {types && <div ref={chips}><HScroll className="flex gap-1.5 pb-1" label="Tipo de cliente">
        {list.map((s) => {
          const Icon = SEGMENT_ICON[s.segment] ?? SEGMENT_ICON.geral; const on = s.id === current?.id; const hint = s.segment === segmentHint;
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => { setId(s.id); setCarry(null); }} title={s.title}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${on ? "border-accent bg-accent/15 text-accent" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>
              {s.mine ? <Star size={13} aria-hidden /> : <Icon size={13} aria-hidden />}{s.mine ? s.title : SEGMENTS[s.segment] ?? s.segment}{hint && <span className="rounded-full bg-ok/20 px-1.5 text-[10px] text-ok">sugerido</span>}
            </button>
          );
        })}
      </HScroll></div>}
      {current && needs !== null ? <p className="rounded-xl bg-sunk px-3 py-6 text-center text-sm text-muted" role="status">{failed ? "Não consegui carregar este roteiro. Escolha outro ou tente de novo." : "Carregando o roteiro…"}</p> : current ? <ScriptPlayer hideNoteBox={hideNoteBox} facts={facts} script={current} vars={vars} objective={obj ?? undefined} onRename={onRename} savedPerson={savedPerson} extra={extra} onNote={onNote} onRun={onRun} onStep={onStep} endExtra={endExtra} floatingCenter /> : <p className="text-sm text-muted">Sem script para esta fase.</p>}
    </div>
  );
}
