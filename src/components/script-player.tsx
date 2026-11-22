"use client";

import { ArrowLeft, Flag, Lightbulb, MessageSquareQuote, RotateCcw, ShieldAlert, ThumbsUp, ChevronRight, PartyPopper } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fillScript, KIND_LABEL, OUTCOMES, type ScriptDoc, type ScriptKind } from "@/config/scripts";
import { btnGhost } from "@/components/ui";

export type ScriptVars = { empresa?: string | null; contato?: string | null; cidade?: string | null; meunome?: string | null };

const KIND_STYLE: Record<ScriptKind, string> = {
  ok: "border-ok/40 bg-ok/10 text-ink hover:bg-ok/20",
  objecao: "border-warn/50 bg-warn/10 text-ink hover:bg-warn/20",
  neutro: "border-line bg-sunk/60 text-ink hover:bg-sunk",
};
const KIND_ICON: Record<ScriptKind, typeof ThumbsUp> = { ok: ThumbsUp, objecao: ShieldAlert, neutro: ChevronRight };

/** O "minigame" da ligação: leia a fala, toque na resposta do lead e o roteiro avança. */
export function ScriptPlayer({ script, vars, onOutcome }: { script: ScriptDoc; vars: ScriptVars; onOutcome?: (o: NonNullable<ScriptDoc["nodes"][number]["outcome"]>) => void }) {
  const by = useMemo(() => new Map(script.nodes.map((n) => [n.id, n])), [script]);
  const [trail, setTrail] = useState<string[]>([script.startId]);
  useEffect(() => setTrail([script.startId]), [script.id, script.startId]);
  const node = by.get(trail[trail.length - 1]) ?? script.nodes[0];
  const ended = node.type === "fim";
  useEffect(() => { if (ended && node.outcome) onOutcome?.(node.outcome); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [node.id]);
  const steps = trail.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted" aria-label="Caminho percorrido">
        {trail.map((id, i) => <span key={`${id}-${i}`} className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${i === trail.length - 1 ? "bg-accent/15 font-semibold text-accent" : "bg-sunk"}`}>{by.get(id)?.title ?? id}</span>)}
      </div>

      <div key={node.id} className="card-in space-y-3 rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">{ended ? <Flag size={14} aria-hidden /> : <MessageSquareQuote size={14} aria-hidden />}{node.title}</p>
        <p className="whitespace-pre-line text-lg font-medium leading-relaxed sm:text-xl">{fillScript(node.say, vars)}</p>
        {node.tip && <p className="flex items-start gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm text-ink"><Lightbulb size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" /><span>{node.tip}</span></p>}
        {ended && node.outcome && (
          <div className="glow-pulse flex items-start gap-3 rounded-xl border border-ok/40 bg-ok/10 p-3">
            <PartyPopper size={20} aria-hidden className="mt-0.5 shrink-0 text-ok" />
            <p className="text-sm"><b>{OUTCOMES[node.outcome].label}.</b> {OUTCOMES[node.outcome].hint}</p>
          </div>
        )}
      </div>

      {!ended && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">O que o lead respondeu?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {node.options.map((op, i) => {
              const Icon = KIND_ICON[op.kind];
              return (
                <button key={i} type="button" disabled={!op.to || !by.has(op.to)} onClick={() => op.to && setTrail((t) => [...t, op.to!])} className={`lift flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition disabled:opacity-50 ${KIND_STYLE[op.kind]}`}>
                  <Icon size={18} aria-hidden className="shrink-0" />
                  <span className="flex-1">{op.label}</span>
                  <span className="hidden text-xs text-muted sm:block">{KIND_LABEL[op.kind]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnGhost} disabled={steps === 0} onClick={() => setTrail((t) => t.slice(0, -1))}><ArrowLeft size={15} aria-hidden /> Voltar um passo</button>
        <button type="button" className={btnGhost} disabled={steps === 0} onClick={() => setTrail([script.startId])}><RotateCcw size={15} aria-hidden /> Recomeçar</button>
      </div>
    </div>
  );
}
