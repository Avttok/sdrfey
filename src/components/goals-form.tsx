"use client";

import type { LucideIcon } from "lucide-react";
import { KIND_ICON } from "@/components/goal-icons";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, panelCls } from "@/components/ui";
import { UnitInput } from "@/components/goal-unit";
import { saveGoalsAction, type PersonGoalInput } from "@/modules/admin/goals";
import { SDR_KINDS, type GoalKind } from "@/modules/settings/goals";

type Kind = GoalKind;
export type GoalPerson = { id: number; name: string; hex: string; off: boolean; today: Record<Kind, number>; own: Record<Kind, PersonGoalInput> };
type Global = Record<Kind, { on: boolean; qty: number }>;

const KINDS = SDR_KINDS.map((d) => ({ k: d.k, title: d.title, sub: d.sub, label: d.label, Icon: KIND_ICON[d.k] }));

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-ok" : "bg-line"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
  );
}

/** `showGlobal`: só gestão/Adm vê o padrão da equipe. Quem só vê o seu recebe um cartão "Minha meta". */
export function GoalsForm({ global, people, canGlobal, editableIds, showGlobal = canGlobal, wd, monthLabel }: { global: Global; people: GoalPerson[]; canGlobal: boolean; editableIds: number[]; showGlobal?: boolean; wd: number; monthLabel: string }) {
  const W = Math.max(1, wd);
  /** Edição só mensal. Guardamos por dia útil (mês ÷ dias úteis, arredondado para cima); o diário aparece apenas como projeção. */
  const toView = (q: number) => q * W;
  const fromView = (v: number) => Math.ceil(v / W);
  const [g, setG] = useState<Global>(global);
  const [per, setPer] = useState<Record<number, Record<Kind, PersonGoalInput>>>(Object.fromEntries(people.map((p) => [p.id, p.own])));
  const [off, setOff] = useState<Record<number, boolean>>(Object.fromEntries(people.map((p) => [p.id, p.off])));
  const { run, pending } = useRun();
  const canEdit = canGlobal;
  const mayEdit = (id: number) => canGlobal || editableIds.includes(id);
  const upd = (id: number, k: Kind, patch: Partial<PersonGoalInput>) => setPer({ ...per, [id]: { ...per[id], [k]: { ...per[id][k], ...patch } } });
  /** Liga/desliga que a pessoa vê: o dela, senão o global. */
  const effOn = (id: number, k: Kind) => !off[id] && (per[id][k].on ?? g[k].on);
  const effQty = (id: number, k: Kind) => per[id][k].qty ?? g[k].qty;

  const save = () => run(() => saveGoalsAction({
    global: g,
    // se a pessoa ficou igual ao global, não guarda ajuste próprio (assim ela acompanha mudanças futuras da meta global)
    perUser: Object.fromEntries(people.filter((p) => mayEdit(p.id)).map((p) => [p.id, { off: !!off[p.id], goals: Object.fromEntries(KINDS.map(({ k }) => [k, { on: per[p.id][k].on === g[k].on ? null : per[p.id][k].on, qty: per[p.id][k].qty }])) as Record<Kind, PersonGoalInput> }])),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <p className="text-xs text-muted">Metas mensais · <b className="text-ink">{W} dias úteis</b> em {monthLabel}. O diário é só projeção.</p>
      {showGlobal && <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map(({ k, title, sub, Icon }) => (
          <section key={k} className={`${panelCls} p-5 transition-opacity ${g[k].on ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-grad text-on-accent shadow-sm"><Icon size={20} aria-hidden /></span>
              <div className="flex-1"><h2 className="display text-xl">{title}</h2><p className="text-sm text-muted">{sub}. Vale para quem não tem meta própria.</p></div>
              <Switch on={g[k].on} disabled={!canEdit} label={`${title} ativa`} onChange={(on) => setG({ ...g, [k]: { ...g[k], on } })} />
            </div>
            <label className="mt-4 flex flex-wrap items-center gap-3 text-sm">Quantidade por mês
              <UnitInput ariaLabel={`${title}: quantidade global`} disabled={!canEdit || !g[k].on} className="!w-28 text-center" stored={g[k].qty} toView={toView} fromView={fromView} onCommit={(v) => setG({ ...g, [k]: { ...g[k], qty: v ?? 0 } })} />
              <span className="text-xs text-muted">= <b className="figure text-ink">{g[k].qty}</b> por dia útil</span>
            </label>
          </section>
        ))}
      </div>}

      <section className={`${panelCls} p-5`}>
        <h2 className="display mb-1 text-xl">{showGlobal ? "Meta de cada pessoa" : "Minha meta de hoje"}</h2>
        <p className="mb-3 text-sm text-muted">{showGlobal ? "Deixe a quantidade vazia para seguir a global. Desligar uma meta aqui tira só aquela pessoa dela; Desativar todas desliga as quatro de uma vez." : "Deixe a quantidade vazia para seguir a meta da equipe."}</p>
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className={`grid items-start gap-x-6 gap-y-3 py-4 ${showGlobal ? "lg:grid-cols-2" : "sm:grid-cols-2"}`}>
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${showGlobal ? "lg:col-span-2" : "sm:col-span-2"}`}>
                {showGlobal && <span className="flex items-center gap-2 font-medium"><span aria-hidden className="size-3 rounded-full" style={{ background: p.hex }} />{p.name}</span>}
                <span className="ml-auto flex items-center gap-2 text-xs text-muted">Desativar todas as metas<Switch on={!!off[p.id]} disabled={!mayEdit(p.id)} label={`Desativar todas as metas de ${p.name}`} onChange={(v) => setOff({ ...off, [p.id]: v })} /></span>
              </div>
              {KINDS.map(({ k, title, label }) => {
                const on = effOn(p.id, k), qty = effQty(p.id, k);
                const pct = on && qty ? Math.min(100, Math.round((p.today[k] / qty) * 100)) : 0;
                return (
                  <div key={k} className={on ? "" : "opacity-50"}>
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <Switch on={on} disabled={!mayEdit(p.id) || !!off[p.id]} label={`${title} de ${p.name} ativa`} onChange={(v) => upd(p.id, k, { on: v })} />
                      <span className="flex-1 text-sm">{label}</span>
                      <UnitInput ariaLabel={`${title} de ${p.name}`} disabled={!mayEdit(p.id) || !on} className="!w-24 text-center" placeholder={g[k].qty} title="Vazio = meta global" stored={per[p.id][k].qty} toView={toView} fromView={fromView} onCommit={(v) => upd(p.id, k, { qty: v })} />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1 text-xs text-muted">{on ? <>Hoje: <b className="figure text-ink">{p.today[k]}</b> de {qty} (projeção diária) · meta do mês <b className="figure text-ink">{qty * W}</b></> : "Meta desligada"}</p>
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      </section>

      {canGlobal || editableIds.length > 0 ? <button type="button" className={btnPrimary} disabled={pending} onClick={save}>Salvar metas</button> : <p className="text-sm text-muted">Você pode ver as metas, mas só quem recebeu essa permissão do Adm pode alterar.</p>}
    </div>
  );
}
