"use client";

import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { saveGoalsAction } from "@/modules/admin/goals";

export function GoalsForm({ global, people, canEdit }: { global: number; people: { id: number; name: string; goal: number | null; today: number }[]; canEdit: boolean }) {
  const [g, setG] = useState(global);
  const [per, setPer] = useState<Record<number, number | null>>(Object.fromEntries(people.map((p) => [p.id, p.goal])));
  const { run, pending } = useRun();
  return (
    <div className="max-w-3xl space-y-4">
      <section className={`${panelCls} flex flex-wrap items-end justify-between gap-4 p-5`}>
        <div>
          <h2 className="display text-xl">Meta global</h2>
          <p className="mt-1 text-sm text-muted">Contatos por dia, por pessoa. Vale para quem não tem meta própria.</p>
        </div>
        <input type="number" min={0} aria-label="Meta global" disabled={!canEdit} className={`${inputCls} !w-32 text-center`} value={g} onChange={(e) => setG(Number(e.target.value))} />
      </section>

      <section className={`${panelCls} p-5`}>
        <h2 className="display mb-3 text-xl">Meta de cada pessoa</h2>
        <ul className="divide-y divide-line">
          {people.map((p) => {
            const goal = per[p.id] ?? g;
            const pct = goal ? Math.min(100, Math.round((p.today / goal) * 100)) : 0;
            return (
              <li key={p.id} className="grid grid-cols-[8rem_1fr_8rem] items-center gap-4 py-3 max-sm:grid-cols-1">
                <span className="font-medium">{p.name}</span>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">Hoje: <b className="figure text-ink">{p.today}</b> de {goal}</p>
                </div>
                <input type="number" min={0} aria-label={`Meta de ${p.name}`} disabled={!canEdit} className={`${inputCls} text-center`} placeholder={`Global (${g})`} value={per[p.id] ?? ""} onChange={(e) => setPer({ ...per, [p.id]: e.target.value === "" ? null : Number(e.target.value) })} />
              </li>
            );
          })}
        </ul>
      </section>

      {canEdit ? <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveGoalsAction({ global: g, perUser: per }))}>Salvar metas</button> : <p className="text-sm text-muted">Você pode ver as metas, mas só quem recebeu essa permissão do Adm pode alterar.</p>}
    </div>
  );
}
