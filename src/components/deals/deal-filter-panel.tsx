"use client";

import { FilterGroup as Group, Pill, Tri3 } from "@/components/filter-ui";
import { DateInput } from "@/components/date-input";
import { inputCls } from "@/components/ui";
import { STAGE_META } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import type { DealAlertKind } from "@/modules/deals/queries";
import { DEAL_COLORS } from "./color-picker";
import { ALERT_LABEL, SORTS, reaisToCents, type DF } from "./deal-filters";

export type FilterOpts = { sellers: { id: number; name: string }[]; sdrs: { id: number; name: string }[]; ufs: string[] };
const STAGES: DealStage[] = ["novo", "contato", "cotacao", "negociacao", "ganho", "perdido"];
const ALERTS: DealAlertKind[] = ["pool", "novo", "retorno", "cobrar", "parado"];
const IDLE = [["", "Qualquer tempo"], ["1", "1 dia ou mais"], ["2", "2 dias ou mais"], ["3", "3 dias ou mais"], ["7", "1 semana ou mais"], ["15", "15 dias ou mais"], ["30", "1 mês ou mais"]] as const;

/** Filtros avançados da lista de negociações. Tudo opcional; cada grupo mostra o que faz em linguagem simples. */
export function DealFilterPanel({ f, set, opts }: { f: DF; set: (p: Partial<DF>) => void; opts: FilterOpts }) {
  const toggle = <T,>(arr: T[], x: T) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
      <Group title="Etapa" hint="(escolha uma ou mais)" span="xl:col-span-2">
        <div className="flex flex-wrap gap-1.5">{STAGES.map((s) => <Pill key={s} on={f.stages.includes(s)} color={STAGE_META[s].color} onClick={() => set({ stages: toggle(f.stages, s) })}>{STAGE_META[s].label}</Pill>)}</div>
      </Group>
      <Group title="Ordenar por">
        <select aria-label="Ordenar por" className={inputCls} value={f.sort} onChange={(e) => set({ sort: e.target.value as DF["sort"] })}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </Group>

      <Group title="Responsáveis">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-muted">Vendedor<select className={`${inputCls} mt-1`} value={f.seller} onChange={(e) => set({ seller: e.target.value })}><option value="">Todos</option><option value="0">Sem vendedor</option>{opts.sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="block text-xs text-muted">SDR que repassou<select className={`${inputCls} mt-1`} value={f.sdr} onChange={(e) => set({ sdr: e.target.value })}><option value="">Todos</option>{opts.sdrs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>
      </Group>
      <Group title="Onde fica">
        <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
          <label className="block text-xs text-muted">Estado<select className={`${inputCls} mt-1`} value={f.uf} onChange={(e) => set({ uf: e.target.value })}><option value="">Todos</option>{opts.ufs.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label className="block text-xs text-muted">Cidade<input className={`${inputCls} mt-1`} placeholder="Parte do nome" value={f.city} onChange={(e) => set({ city: e.target.value })} /></label>
        </div>
      </Group>
      <Group title="Valor da negociação" hint="(em R$)">
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Valor mínimo" inputMode="decimal" className={inputCls} placeholder="De" value={f.min} onChange={(e) => set({ min: e.target.value })} />
          <input aria-label="Valor máximo" inputMode="decimal" className={inputCls} placeholder="Até" value={f.max} onChange={(e) => set({ max: e.target.value })} />
        </div>
      </Group>

      <Group title="Aberta entre">
        <div className="grid grid-cols-2 gap-2"><DateInput label="Aberta a partir de" value={f.from} onChange={(v) => set({ from: v })} /><DateInput label="Aberta até" value={f.to} onChange={(v) => set({ to: v })} /></div>
      </Group>
      <Group title="Sem contato há" hint="(só abertas)">
        <select aria-label="Sem contato há" className={inputCls} value={f.idle} onChange={(e) => set({ idle: e.target.value })}>{IDLE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </Group>
      <Group title="Tipo de aviso">
        <div className="flex flex-wrap gap-1.5">{ALERTS.map((a) => <Pill key={a} on={f.alerts.includes(a)} onClick={() => set({ alerts: toggle(f.alerts, a) })}>{ALERT_LABEL[a]}</Pill>)}</div>
      </Group>

      <Group title="O que já foi registrado" span="md:col-span-2 xl:col-span-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <Tri3 label="Cotação" v={f.quote} set={(quote) => set({ quote })} />
          <Tri3 label="Roteiro" v={f.script} set={(script) => set({ script })} />
          <Tri3 label="Visita" v={f.visit} set={(visit) => set({ visit })} />
        </div>
      </Group>
      <Group title="Outros">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.react} onChange={(e) => set({ react: e.target.checked })} /> Só clientes reativados</label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Cor da negociação">
          <span className="mr-1 text-xs text-muted">Cor</span>
          {DEAL_COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={f.color === c} onClick={() => set({ color: f.color === c ? "" : c })} className={`size-6 rounded-full border-2 transition hover:scale-110 ${f.color === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />)}
        </div>
      </Group>
    </div>
  );
}

/** Resumo dos filtros ligados, cada um com um X para tirar. */
export function filterChips(f: DF, set: (p: Partial<DF>) => void, opts: FilterOpts): { key: string; label: string; clear: () => void }[] {
  const out: { key: string; label: string; clear: () => void }[] = [];
  const add = (key: string, label: string, clear: () => void) => out.push({ key, label, clear });
  if (f.q.trim()) add("q", `Busca: “${f.q.trim()}”`, () => set({ q: "" }));
  f.stages.forEach((s) => add(`s${s}`, `Etapa: ${STAGE_META[s].label}`, () => set({ stages: f.stages.filter((x) => x !== s) })));
  if (f.seller) add("seller", `Vendedor: ${f.seller === "0" ? "sem vendedor" : opts.sellers.find((s) => String(s.id) === f.seller)?.name ?? "?"}`, () => set({ seller: "" }));
  if (f.sdr) add("sdr", `SDR: ${opts.sdrs.find((s) => String(s.id) === f.sdr)?.name ?? "?"}`, () => set({ sdr: "" }));
  if (f.uf) add("uf", `Estado: ${f.uf}`, () => set({ uf: "" }));
  if (f.city.trim()) add("city", `Cidade: ${f.city.trim()}`, () => set({ city: "" }));
  f.alerts.forEach((a) => add(`a${a}`, `Aviso: ${ALERT_LABEL[a]}`, () => set({ alerts: f.alerts.filter((x) => x !== a) })));
  const lo = reaisToCents(f.min), hi = reaisToCents(f.max);
  if (lo !== null || hi !== null) add("val", `Valor: ${lo !== null ? `de R$ ${f.min}` : ""}${lo !== null && hi !== null ? " " : ""}${hi !== null ? `até R$ ${f.max}` : ""}`, () => set({ min: "", max: "" }));
  if (f.from || f.to) add("dt", `Aberta ${f.from ? `desde ${f.from.split("-").reverse().join("/")}` : ""}${f.from && f.to ? " " : ""}${f.to ? `até ${f.to.split("-").reverse().join("/")}` : ""}`, () => set({ from: "", to: "" }));
  if (f.idle) add("idle", `Sem contato há ${f.idle}+ d`, () => set({ idle: "" }));
  (["quote", "script", "visit"] as const).forEach((k) => { if (f[k]) add(k, `${f[k] === "sim" ? "Com" : "Sem"} ${k === "quote" ? "cotação" : k === "script" ? "roteiro" : "visita"}`, () => set({ [k]: "" } as Partial<DF>)); });
  if (f.react) add("react", "Reativados", () => set({ react: false }));
  if (f.color) add("color", "Cor", () => set({ color: "" }));
  return out;
}
