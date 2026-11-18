"use client";

import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { UnitInput, UnitToggle, type Unit } from "@/components/goal-unit";
import { SALE_BONUS_REAIS, SELLER_METRICS } from "@/config/seller-goals";
import { Switch } from "@/components/goals-form";
import { saveSellerGoalsAction } from "@/modules/admin/goals";

export type SellerGoalPerson = { id: number; name: string; hex: string; own: Record<string, number>; overall: number };
type Global = Record<string, number>;

/** Metas dos vendedores: padrão do time (meta + peso) e ajuste por vendedor. */
export function SellerGoalsForm({ global, people, canGlobal, editableIds, showGlobal = canGlobal, wd, monthLabel }: { global: Global; people: SellerGoalPerson[]; canGlobal: boolean; editableIds: number[]; showGlobal?: boolean; wd: number; monthLabel: string }) {
  const [unit, setUnit] = useState<Unit>("mes");
  const W = Math.max(1, wd);
  /** Guardamos por mês; no modo diário mostra mês ÷ dias úteis e, ao digitar, multiplica de volta. */
  const toView = (v: number) => (unit === "dia" ? Math.round((v / W) * 100) / 100 : v);
  const fromView = (v: number) => (unit === "dia" ? Math.round(v * W) : Math.round(v * 100) / 100);
  const eq = (v: number, money: boolean) => { const x = unit === "dia" ? v : v / W; return money ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : x.toLocaleString("pt-BR", { maximumFractionDigits: 1 }); };
  const [g, setG] = useState<Global>(global);
  const [per, setPer] = useState<Record<number, Record<string, number | "">>>(Object.fromEntries(people.map((p) => [p.id, p.own])));
  const { run, pending } = useRun();
  const canEdit = canGlobal || editableIds.length > 0;
  const mayEdit = (id: number) => canGlobal || editableIds.includes(id);
  const gOn = (k: string) => g[`off_${k}`] !== 1;
  const sum = SELLER_METRICS.filter((m) => gOn(m.key)).reduce((a, m) => a + (g[`w_${m.key}`] || 0), 0);
  const anyOn = SELLER_METRICS.some((m) => gOn(m.key));
  const pAll = (id: number) => per[id].off_all === 1;
  /** Liga/desliga que a pessoa vê: o dela, senão o global; "desligar tudo" vence. */
  const pOn = (id: number, k: string) => !pAll(id) && (per[id][`off_${k}`] === "" || per[id][`off_${k}`] === undefined ? gOn(k) : per[id][`off_${k}`] !== 1);
  const setPer1 = (id: number, patch: Record<string, number | "">) => setPer({ ...per, [id]: { ...per[id], ...patch } });
  const n = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <section className={`${panelCls} space-y-5 p-5`}>
      <div>
        <h2 className="display text-xl">{showGlobal ? "Metas dos vendedores" : "Ajustar minhas metas de vendas"}</h2>
        <p className="text-sm text-muted">{showGlobal ? `Metas mensais. O peso diz o quanto cada métrica influencia a meta geral (a soma das ligadas precisa dar 100%). Bônus: R$ ${SALE_BONUS_REAIS} por venda, valendo só a primeira de cada cliente.` : "Deixe vazio para seguir a meta padrão da equipe (mostrada em cinza)."}</p>
      </div>
      <UnitToggle unit={unit} onChange={setUnit} wd={W} monthLabel={monthLabel} />
      {showGlobal && <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="w-16 pb-2 font-medium">Ativa</th><th className="pb-2 font-medium">Métrica</th><th className="pb-2 font-medium">Meta padrão{" "}<span className="font-normal">({unit === "dia" ? "por dia útil" : "mês"})</span></th><th className="pb-2 font-medium">Peso (%)</th></tr></thead>
          <tbody className="divide-y divide-line">
            {SELLER_METRICS.map((m) => (
              <tr key={m.key} className={gOn(m.key) ? "" : "opacity-50"}>
                <td className="py-2.5 pr-3"><Switch on={gOn(m.key)} disabled={!canGlobal} label={`${m.label} ativa para a equipe`} onChange={(v) => setG({ ...g, [`off_${m.key}`]: v ? 0 : 1 })} /></td>
                <td className="py-2.5 pr-3"><span className="font-medium">{m.label}</span><span className="block text-xs text-muted">{m.hint}</span></td>
                <td className="py-2.5 pr-3"><span className="relative block w-36">{m.kind === "money" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>}<UnitInput ariaLabel={`Meta padrão de ${m.label}`} disabled={!canGlobal || !gOn(m.key)} className={`text-right ${m.kind === "money" ? "!pl-9" : ""}`} stored={g[m.key]} toView={toView} fromView={fromView} onCommit={(v) => setG({ ...g, [m.key]: v ?? 0 })} /></span><span className="mt-1 block text-[11px] text-muted">≈ {eq(g[m.key] ?? 0, m.kind === "money")} {unit === "dia" ? "no mês" : "por dia útil"}</span></td>
                <td className="py-2.5"><input type="number" min={0} max={100} aria-label={`Peso de ${m.label}`} disabled={!canGlobal || !gOn(m.key)} className={`${inputCls} !w-24 text-right`} value={g[`w_${m.key}`]} onChange={(e) => setG({ ...g, [`w_${m.key}`]: n(e.target.value) })} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-line"><td colSpan={3} className="pr-3 pt-3 text-right text-sm font-medium text-muted">Soma dos pesos</td><td className="pt-3"><span className={`block w-24 px-3 text-right text-sm font-bold ${sum === 100 || !anyOn ? "text-ok" : "text-danger"}`}>{anyOn ? sum : 0}%</span></td></tr></tfoot>
        </table>
      </div>}
      {people.length > 0 && (
        <div className="space-y-3">
          {showGlobal && <h3 className="text-sm font-semibold">Meta própria de cada vendedor <span className="font-normal text-muted">(vazio = meta padrão)</span></h3>}
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="space-y-2 py-3">
                <p className="flex flex-wrap items-center gap-2 font-medium">{showGlobal && <><span aria-hidden className="size-3 rounded-full" style={{ background: p.hex }} />{p.name}</>}<span className="figure ml-auto text-xs text-muted">{pAll(p.id) ? "metas desativadas" : <>meta geral no mês: <b className="text-ink">{Math.round(p.overall)}%</b></>}</span><span className="flex items-center gap-2 text-xs font-normal text-muted">Desativar todas<Switch on={pAll(p.id)} disabled={!mayEdit(p.id)} label={`Desativar todas as metas de vendas de ${p.name}`} onChange={(v) => setPer1(p.id, { off_all: v ? 1 : "" })} /></span></p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SELLER_METRICS.map((m) => (
                    <div key={m.key} className={`block text-xs text-muted ${pOn(p.id, m.key) ? "" : "opacity-50"}`}><span className="mb-0.5 flex items-center justify-between gap-2"><span>{m.label}</span><Switch on={pOn(p.id, m.key)} disabled={!mayEdit(p.id) || pAll(p.id)} label={`${m.label} de ${p.name} ativa`} onChange={(v) => setPer1(p.id, { [`off_${m.key}`]: v === gOn(m.key) ? "" : v ? 0 : 1 })} /></span>
                      <span className="relative mt-1 block">{m.kind === "money" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>}<UnitInput ariaLabel={`${m.label} de ${p.name}`} disabled={!mayEdit(p.id) || !pOn(p.id, m.key)} className={`text-right ${m.kind === "money" ? "!pl-9" : ""}`} placeholder={g[m.key]} stored={per[p.id][m.key] ?? ""} toView={toView} fromView={fromView} onCommit={(v) => setPer({ ...per, [p.id]: { ...per[p.id], [m.key]: v === null ? "" : v } })} /></span>
                      <span className="mt-1 block text-[11px]">≈ {eq(Number(per[p.id][m.key] || g[m.key] || 0), m.kind === "money")} {unit === "dia" ? "no mês" : "por dia útil"}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canEdit
        ? <button type="button" className={btnPrimary} disabled={pending || (canGlobal && anyOn && sum !== 100)} onClick={() => run(() => saveSellerGoalsAction({ global: g, perUser: Object.fromEntries(people.filter((p) => mayEdit(p.id)).map((p) => [p.id, Object.fromEntries(Object.entries(per[p.id]).filter(([, v]) => v !== "")) as Record<string, number>])) }))}>Salvar metas de vendas</button>
        : <p className="text-sm text-muted">Só quem recebeu a permissão de metas pode alterar.</p>}
    </section>
  );
}
