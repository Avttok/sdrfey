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
    <div className={`${panelCls} space-y-4 p-5`}>
      <label className="block max-w-xs text-sm font-medium">Meta global (contatos por dia, por pessoa)<input type="number" min={0} disabled={!canEdit} className={`${inputCls} mt-1`} value={g} onChange={(e) => setG(Number(e.target.value))} /></label>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted"><th className="py-1.5">Pessoa</th><th>Hoje</th><th>Meta própria</th></tr></thead>
        <tbody>{people.map((p) => (
          <tr key={p.id} className="border-t border-line"><td className="py-2 font-medium">{p.name}</td><td className="figure">{p.today}</td>
            <td><input type="number" min={0} disabled={!canEdit} className={`${inputCls} !w-28 !py-1.5`} placeholder={`Global (${g})`} value={per[p.id] ?? ""} onChange={(e) => setPer({ ...per, [p.id]: e.target.value === "" ? null : Number(e.target.value) })} /></td></tr>
        ))}</tbody>
      </table>
      {canEdit ? <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveGoalsAction({ global: g, perUser: per }))}>Salvar metas</button> : <p className="text-xs text-muted">Você pode ver as metas, mas só quem recebeu essa permissão do Adm pode alterar.</p>}
    </div>
  );
}
