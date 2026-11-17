"use client";

import { CircleDollarSign, PhoneCall } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { saveSellerGoalsAction } from "@/modules/admin/goals";

export type SellerGoalPerson = { id: number; name: string; hex: string; contactsToday: number; salesMonth: number; ownContacts: number | null; ownSales: number | null };

/** Metas dos vendedores: contatos por dia e vendas por mês. */
export function SellerGoalsForm({ global, people, canEdit }: { global: { contacts: number; sales: number }; people: SellerGoalPerson[]; canEdit: boolean }) {
  const [g, setG] = useState(global);
  const [per, setPer] = useState(Object.fromEntries(people.map((p) => [p.id, { contacts: p.ownContacts, sales: p.ownSales }])));
  const { run, pending } = useRun();
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <section className={`${panelCls} space-y-5 p-5`}>
      <div>
        <h2 className="display text-xl">Metas dos vendedores</h2>
        <p className="text-sm text-muted">Contatos por dia (ligações, WhatsApp e e-mails nas negociações) e vendas fechadas por mês.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-sm"><span className="grid size-9 place-items-center rounded-lg bg-grad-soft text-accent"><PhoneCall size={16} aria-hidden /></span><span className="flex-1">Contatos por dia (global)</span>
          <input type="number" min={0} disabled={!canEdit} className={`${inputCls} !w-24 text-center`} value={g.contacts} onChange={(e) => setG({ ...g, contacts: Number(e.target.value) })} /></label>
        <label className="flex items-center gap-3 text-sm"><span className="grid size-9 place-items-center rounded-lg bg-grad-soft text-accent"><CircleDollarSign size={16} aria-hidden /></span><span className="flex-1">Vendas por mês (global)</span>
          <input type="number" min={0} disabled={!canEdit} className={`${inputCls} !w-24 text-center`} value={g.sales} onChange={(e) => setG({ ...g, sales: Number(e.target.value) })} /></label>
      </div>
      <ul className="divide-y divide-line">
        {people.map((p) => {
          const c = per[p.id].contacts ?? g.contacts, s = per[p.id].sales ?? g.sales;
          return (
            <li key={p.id} className="grid items-center gap-x-6 gap-y-2 py-3 lg:grid-cols-[7rem_1fr_1fr]">
              <span className="flex items-center gap-2 font-medium"><span aria-hidden className="size-3 rounded-full" style={{ background: p.hex }} />{p.name}</span>
              <div className="text-sm"><div className="mb-1 flex items-center gap-2"><span className="flex-1">Contatos/dia</span><input type="number" min={0} aria-label={`Contatos por dia de ${p.name}`} disabled={!canEdit} className={`${inputCls} !w-24 text-center`} placeholder={String(g.contacts)} value={per[p.id].contacts ?? ""} onChange={(e) => setPer({ ...per, [p.id]: { ...per[p.id], contacts: num(e.target.value) } })} /></div>
                <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-accent" style={{ width: `${c ? Math.min(100, (p.contactsToday / c) * 100) : 0}%` }} /></div><p className="mt-1 text-xs text-muted">Hoje: <b className="figure text-ink">{p.contactsToday}</b> de {c}</p></div>
              <div className="text-sm"><div className="mb-1 flex items-center gap-2"><span className="flex-1">Vendas/mês</span><input type="number" min={0} aria-label={`Vendas por mês de ${p.name}`} disabled={!canEdit} className={`${inputCls} !w-24 text-center`} placeholder={String(g.sales)} value={per[p.id].sales ?? ""} onChange={(e) => setPer({ ...per, [p.id]: { ...per[p.id], sales: num(e.target.value) } })} /></div>
                <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-accent" style={{ width: `${s ? Math.min(100, (p.salesMonth / s) * 100) : 0}%` }} /></div><p className="mt-1 text-xs text-muted">No mês: <b className="figure text-ink">{p.salesMonth}</b> de {s}</p></div>
            </li>
          );
        })}
        {people.length === 0 && <li className="py-3 text-sm text-muted">Nenhum vendedor cadastrado ainda.</li>}
      </ul>
      {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveSellerGoalsAction({ global: g, perUser: per }))}>Salvar metas de vendas</button>}
    </section>
  );
}
