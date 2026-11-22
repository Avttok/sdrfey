"use client";

import { Copy, Pencil, Play, Plus, ScrollText, Trash2 } from "lucide-react";
import { useState } from "react";
import { GOALS, SEGMENTS, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { deleteScriptAction, duplicateScriptAction } from "@/modules/scripts/actions";
import { blankScript, ScriptEditor } from "./script-editor";
import { ScriptPlayer } from "./script-player";

export function ScriptsView({ scripts, isAdmin, myName }: { scripts: ScriptDoc[]; isAdmin: boolean; myName: string }) {
  const [goal, setGoal] = useState<ScriptGoal | "todos">("todos");
  const [mode, setMode] = useState<{ t: "list" } | { t: "play"; s: ScriptDoc } | { t: "edit"; s: ScriptDoc }>({ t: "list" });
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const shown = scripts.filter((s) => goal === "todos" || s.goal === goal);
  const canEdit = (s: ScriptDoc) => s.mine || (isAdmin && s.global);

  if (mode.t === "edit") return <ScriptEditor initial={mode.s} isAdmin={isAdmin} onClose={() => setMode({ t: "list" })} />;
  if (mode.t === "play") return (
    <div className="space-y-3">
      <button type="button" className={btnGhost} onClick={() => setMode({ t: "list" })}>← Todos os scripts</button>
      <h2 className="text-lg font-semibold">{mode.s.title}</h2>
      <div className={`${panelCls} p-4`}><ScriptPlayer script={mode.s} vars={{ empresa: "Auto Peças Modelo", contato: "Carlos", cidade: "Campinas", meunome: myName }} /></div>
      <p className="text-xs text-muted">Treino com dados de exemplo. No Shuffler (passo Ligação) o script usa os dados do lead real.</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", ...Object.keys(GOALS)] as const).map((k) => <button key={k} type="button" aria-pressed={goal === k} onClick={() => setGoal(k as ScriptGoal | "todos")} className={`rounded-full border px-3 py-1.5 text-sm transition ${goal === k ? "border-accent bg-accent/15 font-semibold text-accent" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>{k === "todos" ? "Todos" : GOALS[k as ScriptGoal].label}</button>)}
        <span className="flex-1" />
        <button type="button" className={btnPrimary} onClick={() => setMode({ t: "edit", s: blankScript(goal === "todos" ? "sdr" : goal) })}><Plus size={15} aria-hidden /> Meu novo script</button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.id} className={`${panelCls} lift flex flex-col gap-2 p-4 ${s.active ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-grad-soft text-accent"><ScrollText size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.mine ? "★ " : ""}{s.title}</p>
                <p className="text-xs text-muted">{GOALS[s.goal].label} · {SEGMENTS[s.segment] ?? s.segment} · {s.nodes.length} passos{s.global ? " · do time" : ""}{s.active ? "" : " · inativo"}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-1.5">
              <button type="button" className={btnPrimary} onClick={() => setMode({ t: "play", s })}><Play size={14} aria-hidden /> Treinar</button>
              {canEdit(s) && <button type="button" className={btnGhost} onClick={() => setMode({ t: "edit", s })}><Pencil size={14} aria-hidden /> Editar</button>}
              <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => duplicateScriptAction(s.id))}><Copy size={14} aria-hidden /> Copiar para mim</button>
              {canEdit(s) && <button type="button" aria-label="Excluir script" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir este script?", body: `"${s.title}" será excluído.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteScriptAction(s.id)) })}><Trash2 size={14} /></button>}
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-muted">Nenhum script aqui ainda.</li>}
      </ul>
      {dialog}
    </div>
  );
}
