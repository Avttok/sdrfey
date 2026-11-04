"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TagChip } from "@/components/tag-chip";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { deleteTagAction, saveTagAction } from "@/modules/admin/config";

export type TagRow = { id?: number; groupKey: string; label: string; color: string; blocksSorting: boolean; cooldownDays: number | null; active: boolean; autoOnly?: boolean };

function Row({ t, isNew }: { t: TagRow; isNew?: boolean }) {
  const [f, setF] = useState(t);
  const { run, pending } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg bg-sunk p-2.5 text-sm">
      <input className={`${inputCls} !w-40 !py-1.5`} aria-label="Nome" placeholder="Nome da tag" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <input type="color" aria-label="Cor" className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
      {!isNew && <TagChip label={f.label || "—"} color={f.color} />}
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.blocksSorting} onChange={(e) => setF({ ...f, blocksSorting: e.target.checked })} /> Tira do sorteio</label>
      <label className="flex items-center gap-1.5">Volta em <input type="number" min={0} className={`${inputCls} !w-16 !py-1`} placeholder="—" value={f.cooldownDays ?? ""} onChange={(e) => setF({ ...f, cooldownDays: e.target.value === "" ? null : Number(e.target.value) })} /> dias</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativa</label>
      {t.autoOnly && <span className="text-xs text-muted">(só o sistema aplica)</span>}
      <span className="flex-1" />
      <button type="button" className={isNew ? btnPrimary : btnGhost} disabled={pending} onClick={() => run(() => saveTagAction({ ...f, id: t.id }), undefined, () => isNew && setF(t))}>{isNew ? <><Plus size={15} aria-hidden /> Criar</> : "Salvar"}</button>
      {!isNew && <button type="button" aria-label="Excluir tag" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => { if (confirm(`Excluir a tag ${t.label}?`)) run(() => deleteTagAction(t.id!)); }}><Trash2 size={15} /></button>}
    </li>
  );
}

export function TagsAdmin({ groups }: { groups: { key: string; name: string; tags: TagRow[] }[] }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key} className={`${panelCls} space-y-2 p-4`}>
          <h2 className="display text-xl">{g.name}</h2>
          <ul className="space-y-2">
            {g.tags.map((t) => <Row key={t.id} t={t} />)}
            <Row isNew t={{ groupKey: g.key, label: "", color: "#64748b", blocksSorting: false, cooldownDays: null, active: true }} />
          </ul>
        </section>
      ))}
    </div>
  );
}
