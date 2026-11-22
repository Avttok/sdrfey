"use client";

import { Calculator, Check, CreditCard, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionCard } from "@/components/section-card";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { deletePaymentTermAction, deleteProductAction, savePaymentTermAction, saveProductAction, saveExtraTaxAction, saveIcmsRuleAction } from "@/modules/admin/sales";
import { UFS } from "@/config/lists";
import type { IcmsRule } from "@/modules/quotes/icms";

export type TermRow = { id: number; name: string; active: boolean };
export type ProductRow = { id: number; code: string; description: string; kind: string | null; unit: string | null; altCodes: string[] };
const brl = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function Terms({ rows }: { rows: TermRow[] }) {
  const { run, pending } = useRun();
  const [edit, setEdit] = useState<{ id: number | null; name: string; active: boolean } | null>(null);
  const [del, setDel] = useState<TermRow | null>(null);
  return (
    <SectionCard icon={CreditCard} title={`Condições de pagamento (${rows.length})`}>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            {edit?.id === t.id ? (
              <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => savePaymentTermAction(t.id, edit.name, edit.active), undefined, () => setEdit(null)); }}>
                <input autoFocus aria-label="Nome da condição" className={`${inputCls} !w-auto min-w-48 flex-1`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Ativa</label>
                <button className={btnPrimary} disabled={pending}><Check size={15} aria-hidden /> Salvar</button>
                <button type="button" className={btnGhost} onClick={() => setEdit(null)}><X size={15} aria-hidden /> Cancelar</button>
              </form>
            ) : (
              <>
                <span className={`flex-1 font-medium ${t.active ? "" : "text-muted line-through"}`}>{t.name}</span>
                {!t.active && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">Inativa</span>}
                <button type="button" aria-label={`Editar ${t.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk" onClick={() => setEdit({ id: t.id, name: t.name, active: t.active })}><Pencil size={15} aria-hidden /></button>
                <button type="button" aria-label={`Remover ${t.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setDel(t)}><Trash2 size={15} aria-hidden /></button>
              </>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="px-3 py-4 text-sm text-muted">Nenhuma condição ainda. Leia uma cotação em PDF ou adicione abaixo.</li>}
      </ul>
      {edit?.id === null
        ? <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => savePaymentTermAction(null, edit.name, true), undefined, () => setEdit(null)); }}>
            <input autoFocus aria-label="Nova condição" placeholder="Ex.: 28/35/42 DDL" className={`${inputCls} !w-auto min-w-48 flex-1`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <button className={btnPrimary} disabled={pending}><Check size={15} aria-hidden /> Adicionar</button>
            <button type="button" className={btnGhost} onClick={() => setEdit(null)}>Cancelar</button>
          </form>
        : <button type="button" className={btnGhost} onClick={() => setEdit({ id: null, name: "", active: true })}><Plus size={15} aria-hidden /> Nova condição</button>}
      <ConfirmDialog open={!!del} tone="danger" icon={Trash2} title="Remover condição?" confirmLabel="Sim, remover" busy={pending} onCancel={() => setDel(null)} onConfirm={() => { const d = del; setDel(null); if (d) run(() => deletePaymentTermAction(d.id)); }}>
        “{del?.name}” sai da lista. Cotações antigas mantêm o texto. Se preferir só esconder, desmarque “Ativa”.
      </ConfirmDialog>
    </SectionCard>
  );
}

type PEdit = { id: number | null; code: string; description: string; kind: string; unit: string; altCodes: string };
function Products({ rows }: { rows: ProductRow[] }) {
  const { run, pending } = useRun();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<PEdit | null>(null);
  const [del, setDel] = useState<ProductRow | null>(null);
  const [limit, setLimit] = useState(50);
  const shown = useMemo(() => { const k = q.trim().toLowerCase(); return k ? rows.filter((r) => r.code.toLowerCase().includes(k) || r.description.toLowerCase().includes(k) || (r.kind ?? "").toLowerCase().includes(k) || r.altCodes.some((a) => a.toLowerCase().includes(k))) : rows; }, [rows, q]);
  const field = (label: string, k: keyof PEdit, cls = "") => <label className={`flex flex-col gap-1 text-xs font-medium text-muted ${cls}`}>{label}<input className={inputCls} value={edit![k] ?? ""} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} /></label>;
  return (
    <SectionCard icon={Package} title={`Catálogo de produtos (${rows.length})`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} !pl-9`} placeholder="Buscar por código, descrição ou tipo" aria-label="Buscar produto" value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} /></div>
        <button type="button" className={btnGhost} onClick={() => setEdit({ id: null, code: "", description: "", kind: "", unit: "CEN", altCodes: "" })}><Plus size={15} aria-hidden /> Novo produto</button>
      </div>
      {edit && (
        <form className="grid gap-3 rounded-xl border border-accent/40 bg-sunk/40 p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run(() => saveProductAction(edit.id, edit), undefined, () => setEdit(null)); }}>
          {field("Código", "code")}{field("Descrição", "description", "sm:col-span-3")}{field("Tipo", "kind")}{field("Unidade", "unit")}
          <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">Códigos alternativos (outras empresas ou distribuidores)<textarea rows={2} className={`${inputCls} min-h-16`} placeholder="Separe por vírgula ou linha. Ex.: AB-123, 99887" value={edit.altCodes} onChange={(e) => setEdit({ ...edit, altCodes: e.target.value })} /><span className="font-normal">Se o cliente trouxer qualquer um destes códigos, o sistema reconhece este produto.</span></label>
          <div className="flex items-end gap-2"><button className={btnPrimary} disabled={pending}><Check size={15} aria-hidden /> Salvar</button><button type="button" className={btnGhost} onClick={() => setEdit(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-sunk/50 text-left text-xs text-muted"><th className="p-2.5 font-medium">Código</th><th className="p-2.5 font-medium">Descrição</th><th className="hidden p-2.5 font-medium sm:table-cell">Tipo</th><th className="p-2.5 font-medium">Códigos alternativos</th><th className="w-20 p-2.5" /></tr></thead>
          <tbody className="divide-y divide-line">
            {shown.slice(0, limit).map((p) => (
              <tr key={p.id}>
                <td className="figure p-2.5 font-semibold">{p.code}</td><td className="p-2.5">{p.description}</td>
                <td className="hidden p-2.5 capitalize text-muted sm:table-cell">{p.kind?.toLowerCase() ?? "—"}</td>
                <td className="p-2.5"><div className="flex flex-wrap gap-1">{p.altCodes.length ? p.altCodes.map((a) => <span key={a} className="figure rounded-md bg-sunk px-1.5 py-0.5 text-xs text-muted">{a}</span>) : <span className="text-muted">—</span>}</div></td>
                <td className="p-1.5"><div className="flex justify-end">
                  <button type="button" aria-label={`Editar ${p.code}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk" onClick={() => setEdit({ id: p.id, code: p.code, description: p.description, kind: p.kind ?? "", unit: p.unit ?? "", altCodes: p.altCodes.join(", ") })}><Pencil size={14} aria-hidden /></button>
                  <button type="button" aria-label={`Remover ${p.code}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setDel(p)}><Trash2 size={14} aria-hidden /></button>
                </div></td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted">{rows.length ? "Nada encontrado." : "O catálogo está vazio. Ele se enche conforme as cotações forem registradas."}</td></tr>}
          </tbody>
        </table>
      </div>
      {shown.length > limit && <button type="button" className={btnGhost} onClick={() => setLimit(limit + 100)}>Mostrar mais ({shown.length - limit})</button>}
      <ConfirmDialog open={!!del} tone="danger" icon={Trash2} title="Remover produto?" confirmLabel="Sim, remover" busy={pending} onCancel={() => setDel(null)} onConfirm={() => { const d = del; setDel(null); if (d) run(() => deleteProductAction(d.id)); }}>
        {del?.code} · {del?.description} sai do catálogo. As cotações antigas não mudam.
      </ConfirmDialog>
    </SectionCard>
  );
}

function ExtraTax({ pct }: { pct: number }) {
  const { run, pending } = useRun();
  const [v, setV] = useState(String(pct).replace(".", ","));
  return (
    <SectionCard icon={Calculator} title="Cálculo do valor sem impostos">
      <p className="text-sm text-muted">Valor sem impostos = (total − IPI − ICMS) menos este percentual (PIS/COFINS) sobre o que sobra. Use 0 para só tirar IPI e ICMS. Vale para cotações novas ou editadas.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => saveExtraTaxAction(Number(v.replace(",", ".")))); }}>
        <label className="block text-sm"><span className="mb-1 block text-muted">Imposto extra (%)</span><input className={`${inputCls} !w-32 text-right`} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} /></label>
        <button className={btnPrimary} disabled={pending}><Check size={15} aria-hidden /> Salvar</button>
      </form>
    </SectionCard>
  );
}

function IcmsCard({ rule }: { rule: IcmsRule }) {
  const { run, pending } = useRun();
  const [mode, setMode] = useState(rule.mode);
  const [def, setDef] = useState(String(rule.defaultPct).replace(".", ","));
  const [by, setBy] = useState<Record<string, string>>(Object.fromEntries(UFS.map((u) => [u, String(rule.byUf[u] ?? rule.defaultPct).replace(".", ",")])));
  const num = (v: string) => Number(v.replace(",", "."));
  return (
    <SectionCard icon={Calculator} title="ICMS das cotações">
      <p className="text-sm text-muted">O vendedor só vê o valor sem impostos (total − impostos). Aqui você decide de onde vem o ICMS desse cálculo. Dá para mudar numa cotação específica, no campo “ICMS %” da própria cotação.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {([["pdf", "Usar o valor do PDF", "O ICMS vem como está nos itens da cotação (comportamento antigo). Os percentuais só valem se digitados na cotação."], ["rate", "Calcular por percentual", "O ICMS é calculado pelo percentual da UF do cliente (ou o padrão) sobre os produtos."]] as const).map(([k, t, d]) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`lift rounded-2xl border p-3 text-left transition ${mode === k ? "border-accent bg-accent/10" : "border-line bg-sunk/50"}`}><b className="block text-sm">{t}</b><span className="text-xs text-muted">{d}</span></button>
        ))}
      </div>
      <div className={mode === "rate" ? "space-y-3" : "space-y-3 opacity-60"}>
        <label className="block text-sm"><span className="mb-1 block text-muted">Padrão (UF sem percentual) %</span><input className={`${inputCls} !w-28 text-right`} inputMode="decimal" value={def} onChange={(e) => setDef(e.target.value)} /></label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {UFS.map((u) => <label key={u} className="text-xs"><span className="mb-0.5 block font-semibold text-muted">{u}</span><input aria-label={`ICMS ${u}`} className={`${inputCls} text-right`} inputMode="decimal" value={by[u]} onChange={(e) => setBy({ ...by, [u]: e.target.value })} /></label>)}
        </div>
      </div>
      <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveIcmsRuleAction({ mode, defaultPct: num(def), byUf: Object.fromEntries(UFS.map((u) => [u, num(by[u])])) }))}><Check size={15} aria-hidden /> Salvar regra de ICMS</button>
    </SectionCard>
  );
}

export function SalesAdmin({ terms, products, extraTaxPct, icmsRule }: { terms: TermRow[]; products: ProductRow[]; extraTaxPct: number; icmsRule: IcmsRule }) {
  return <div className="space-y-5"><IcmsCard rule={icmsRule} /><ExtraTax pct={extraTaxPct} /><Terms rows={terms} /><Products rows={products} /></div>;
}
