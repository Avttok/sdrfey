"use client";

import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { SALE_BONUS_REAIS, SELLER_METRICS } from "@/config/seller-goals";
import { saveSellerGoalsAction } from "@/modules/admin/goals";

export type SellerGoalPerson = { id: number; name: string; hex: string; own: Record<string, number>; overall: number };
type Global = Record<string, number>;

/** Metas dos vendedores: padrão do time (meta + peso) e ajuste por vendedor. */
export function SellerGoalsForm({ global, people, canEdit }: { global: Global; people: SellerGoalPerson[]; canEdit: boolean }) {
  const [g, setG] = useState<Global>(global);
  const [per, setPer] = useState<Record<number, Record<string, number | "">>>(Object.fromEntries(people.map((p) => [p.id, p.own])));
  const { run, pending } = useRun();
  const sum = SELLER_METRICS.reduce((a, m) => a + (g[`w_${m.key}`] || 0), 0);
  const n = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <section className={`${panelCls} space-y-5 p-5`}>
      <div>
        <h2 className="display text-xl">Metas dos vendedores</h2>
        <p className="text-sm text-muted">Metas mensais. O peso diz o quanto cada métrica influencia a meta geral (a soma precisa dar 100%). Bônus: R$ {SALE_BONUS_REAIS} por venda, valendo só a primeira de cada cliente.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-medium">Métrica</th><th className="pb-2 font-medium">Meta padrão{" "}<span className="font-normal">(mês)</span></th><th className="pb-2 font-medium">Peso (%)</th></tr></thead>
          <tbody className="divide-y divide-line">
            {SELLER_METRICS.map((m) => (
              <tr key={m.key}>
                <td className="py-2.5 pr-3"><span className="font-medium">{m.label}</span><span className="block text-xs text-muted">{m.hint}</span></td>
                <td className="py-2.5 pr-3"><span className="flex items-center gap-1.5">{m.kind === "money" && <span className="text-muted">R$</span>}<input type="number" min={0} aria-label={`Meta padrão de ${m.label}`} disabled={!canEdit} className={`${inputCls} !w-32 text-right`} value={g[m.key]} onChange={(e) => setG({ ...g, [m.key]: n(e.target.value) })} /></span></td>
                <td className="py-2.5"><input type="number" min={0} max={100} aria-label={`Peso de ${m.label}`} disabled={!canEdit} className={`${inputCls} !w-24 text-right`} value={g[`w_${m.key}`]} onChange={(e) => setG({ ...g, [`w_${m.key}`]: n(e.target.value) })} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2} className="pt-2 text-right text-xs text-muted">Soma dos pesos</td><td className={`pt-2 font-bold ${sum === 100 ? "text-ok" : "text-danger"}`}>{sum}%</td></tr></tfoot>
        </table>
      </div>
      {people.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Meta própria de cada vendedor <span className="font-normal text-muted">(vazio = meta padrão)</span></h3>
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="space-y-2 py-3">
                <p className="flex items-center gap-2 font-medium"><span aria-hidden className="size-3 rounded-full" style={{ background: p.hex }} />{p.name}<span className="figure ml-auto text-xs text-muted">meta geral no mês: <b className="text-ink">{Math.round(p.overall)}%</b></span></p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SELLER_METRICS.map((m) => (
                    <label key={m.key} className="block text-xs text-muted">{m.label}
                      <input type="number" min={0} disabled={!canEdit} className={`${inputCls} mt-1 text-right`} placeholder={String(g[m.key])} value={per[p.id][m.key] ?? ""} onChange={(e) => setPer({ ...per, [p.id]: { ...per[p.id], [m.key]: e.target.value === "" ? "" : Number(e.target.value) } })} />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canEdit
        ? <button type="button" className={btnPrimary} disabled={pending || sum !== 100} onClick={() => run(() => saveSellerGoalsAction({ global: g, perUser: Object.fromEntries(people.map((p) => [p.id, Object.fromEntries(Object.entries(per[p.id]).filter(([, v]) => v !== "")) as Record<string, number>])) }))}>Salvar metas de vendas</button>
        : <p className="text-sm text-muted">Só quem recebeu a permissão de metas pode alterar.</p>}
    </section>
  );
}
