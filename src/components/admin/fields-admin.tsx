"use client";

import { Lightbulb, PlusCircle, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { FIELD_GROUPS, FIELD_KINDS, type FieldDefView, type FieldKind } from "@/config/facts";
import { analyzeFieldsAction, decideSuggestionAction, saveFieldAction } from "@/modules/facts/admin";
import type { FieldStat } from "@/modules/facts/intel";

type Sug = { id: number; label: string; kind: string; scope: string; evidence: number; examples: string[]; options: string[] };
const blank: FieldDefView = { key: "", label: "", kind: "lista", options: [], scope: "lead", groupName: "Outros", ttlDays: 180, priority: 50, active: true };
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function FieldsAdmin({ defs, stats, suggestions }: { defs: FieldDefView[]; stats: FieldStat[]; suggestions: Sug[] }) {
  const { run, pending } = useRun();
  const [edit, setEdit] = useState<FieldDefView | null>(null);
  const [opts, setOpts] = useState("");
  const by = new Map(stats.map((s) => [s.key, s]));
  const open = (d: FieldDefView) => { setEdit(d); setOpts(d.options.join("\n")); };
  const save = () => { if (!edit) return; void run(() => saveFieldAction({ ...edit, key: edit.key || undefined, options: opts.split("\n").map((x) => x.trim()).filter(Boolean) }), undefined, () => setEdit(null)); };
  return (
    <div className="space-y-5">
      <section className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
        <Sparkles size={18} aria-hidden className="text-accent" />
        <p className="min-w-0 flex-1 text-sm"><b>Aprender com o uso:</b> reordena os campos pelo que é respondido e anda junto com negociações, e procura nas observações dos vendedores temas que se repetem e ainda não são campo. Nada muda sozinho: as sugestões esperam a sua aprovação.</p>
        <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => analyzeFieldsAction())}>Analisar agora</button>
      </section>

      {suggestions.length > 0 && (
        <section className={`${panelCls} space-y-3 p-4`} aria-label="Campos sugeridos">
          <h2 className="flex items-center gap-2 text-base font-bold"><Lightbulb size={17} aria-hidden className="text-warn" /> Campos sugeridos</h2>
          <ul className="space-y-2">{suggestions.map((s) => (
            <li key={s.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2"><b>{s.label}</b><span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">{FIELD_KINDS[s.kind as FieldKind]}</span><span className="text-xs text-muted">{s.evidence} leads falaram disso</span>
                <span className="ml-auto flex gap-2"><button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => decideSuggestionAction(s.id, true))}>Criar campo</button><button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => decideSuggestionAction(s.id, false))}>Recusar</button></span></div>
              {s.examples.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted">{s.examples.map((e, i) => <li key={i} className="truncate">“{e}”</li>)}</ul>}
            </li>
          ))}</ul>
        </section>
      )}

      <section className={`${panelCls} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-bold"><TrendingUp size={17} aria-hidden className="text-accent" /> Campos</h2>
          <button type="button" className={btnGhost} onClick={() => open({ ...blank })}><PlusCircle size={15} aria-hidden /> Novo campo</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">Campo</th><th className="pr-3">Tipo</th><th className="pr-3">Prioridade</th><th className="pr-3">Preenchido</th><th className="pr-3">Resposta</th><th className="pr-3">Impacto</th><th /></tr></thead>
          <tbody>{defs.map((d) => { const s = by.get(d.key); return (
            <tr key={d.key} className={`border-b border-line/60 ${d.active ? "" : "opacity-50"}`}>
              <td className="py-2 pr-3"><b>{d.label}</b><span className="block text-xs text-muted">{d.groupName} · {d.scope === "person" ? "do contato" : "da empresa"}</span></td>
              <td className="pr-3 text-muted">{FIELD_KINDS[d.kind]}</td>
              <td className="figure pr-3">{d.priority}</td>
              <td className="figure pr-3">{s ? `${s.leads} leads (${pct(s.coverage)})` : "-"}</td>
              <td className="pr-3 text-muted">{s && s.asked ? `${pct(s.answerRate)} de ${s.asked}` : "sem dados"}{s && s.unknown + s.skipped > 0 ? ` · ${s.unknown + s.skipped} sem resposta` : ""}</td>
              <td className="pr-3">{s?.lift ? <span className={s.lift >= 1.2 ? "font-semibold text-ok" : s.lift < 0.9 ? "text-warn" : "text-muted"}>{s.lift.toFixed(1)}× mais negociações</span> : <span className="text-muted">-</span>}</td>
              <td className="text-right"><button type="button" className="text-accent hover:underline" onClick={() => open(d)}>Editar</button></td>
            </tr>); })}</tbody></table></div>
      </section>

      {edit && (
        <section className={`${panelCls} space-y-3 p-4`} aria-label="Editar campo">
          <h2 className="text-base font-bold">{edit.key ? "Editar campo" : "Novo campo"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Nome<input className={inputCls} value={edit.label} maxLength={60} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium">Tipo<select className={inputCls} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as FieldKind })}>{Object.entries(FIELD_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Vale para<select className={inputCls} value={edit.scope} onChange={(e) => setEdit({ ...edit, scope: e.target.value as "lead" | "person" })}><option value="lead">A empresa</option><option value="person">O contato com quem se fala</option></select></label>
            <label className="space-y-1 text-sm font-medium">Grupo<select className={inputCls} value={edit.groupName} onChange={(e) => setEdit({ ...edit, groupName: e.target.value })}>{FIELD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Confirmar de novo depois de (dias)<input className={inputCls} type="number" min={7} max={1500} value={edit.ttlDays ?? ""} placeholder="Nunca vence" onChange={(e) => setEdit({ ...edit, ttlDays: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="space-y-1 text-sm font-medium">Prioridade (1 a 99)<input className={inputCls} type="number" min={1} max={99} value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) || 50 })} /></label>
          </div>
          {(edit.kind === "lista" || edit.kind === "multi") && <label className="block space-y-1 text-sm font-medium">Opções (uma por linha)<textarea className={`${inputCls} min-h-28`} value={opts} onChange={(e) => setOpts(e.target.value)} /></label>}
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Campo ativo (aparece nas perguntas e no atendimento)</label>
          <div className="flex gap-2"><button type="button" className={btnPrimary} disabled={pending} onClick={save}>Salvar campo</button><button type="button" className={btnGhost} onClick={() => setEdit(null)}>Cancelar</button></div>
        </section>
      )}
    </div>
  );
}
