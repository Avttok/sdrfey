"use client";

import { Check, CreditCard, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionCard } from "@/components/section-card";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { deletePaymentTermAction, deleteProductAction, savePaymentTermAction, saveProductAction } from "@/modules/admin/sales";

export type TermRow = { id: number; name: string; active: boolean };
export type ProductRow = { id: number; code: string; description: string; kind: string | null; unit: string | null; lastUnitCents: number | null; seenCount: number };
const brl = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function Terms({ rows }: { rows: TermRow[] }) {
  const { run, pending } = useRun();
  const [edit, setEdit] = useState<{ id: number | null; name: string; active: boolean } | null>(null);
  const [del, setDel] = useState<TermRow | null>(null);
  return (
    <SectionCard icon={CreditCard} title={`Condições de pagamento (${rows.length})`}>
      <p className="text-sm text-muted">Entram sozinhas quando um PDF é lido. Os vendedores só podem escolher da lista (ativas).</p>
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

type PEdit = { id: number | null; code: string; description: string; kind: string; unit: string; price: string };
function Products({ rows }: { rows: ProductRow[] }) {
  const { run, pending } = useRun();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<PEdit | null>(null);
  const [del, setDel] = useState<ProductRow | null>(null);
  const [limit, setLimit] = useState(50);
  const shown = useMemo(() => { const k = q.trim().toLowerCase(); return k ? rows.filter((r) => r.code.toLowerCase().includes(k) || r.description.toLowerCase().includes(k) || (r.kind ?? "").toLowerCase().includes(k)) : rows; }, [rows, q]);
  const field = (label: string, k: keyof PEdit, cls = "") => <label className={`flex flex-col gap-1 text-xs font-medium text-muted ${cls}`}>{label}<input className={inputCls} value={edit![k] ?? ""} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} /></label>;
  return (
    <SectionCard icon={Package} title={`Catálogo de produtos (${rows.length})`}>
      <p className="text-sm text-muted">Cresce sozinho a cada item visto nas cotações. Aqui você corrige descrições, tipos e preços.</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} !pl-9`} placeholder="Buscar por código, descrição ou tipo" aria-label="Buscar produto" value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} /></div>
        <button type="button" className={btnGhost} onClick={() => setEdit({ id: null, code: "", description: "", kind: "", unit: "CEN", price: "" })}><Plus size={15} aria-hidden /> Novo produto</button>
      </div>
      {edit && (
        <form className="grid gap-3 rounded-xl border border-accent/40 bg-sunk/40 p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run(() => saveProductAction(edit.id, edit), undefined, () => setEdit(null)); }}>
          {field("Código", "code")}{field("Descrição", "description", "sm:col-span-3")}{field("Tipo", "kind")}{field("Unidade", "unit")}{field("Último preço (R$)", "price")}
          <div className="flex items-end gap-2"><button className={btnPrimary} disabled={pending}><Check size={15} aria-hidden /> Salvar</button><button type="button" className={btnGhost} onClick={() => setEdit(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-sunk/50 text-left text-xs text-muted"><th className="p-2.5 font-medium">Código</th><th className="p-2.5 font-medium">Descrição</th><th className="hidden p-2.5 font-medium sm:table-cell">Tipo</th><th className="p-2.5 text-right font-medium">Preço</th><th className="hidden p-2.5 text-right font-medium sm:table-cell">Vezes</th><th className="w-20" /></tr></thead>
          <tbody className="divide-y divide-line">
            {shown.slice(0, limit).map((p) => (
              <tr key={p.id}>
                <td className="figure p-2.5 font-semibold">{p.code}</td><td className="p-2.5">{p.description}</td>
                <td className="hidden p-2.5 capitalize text-muted sm:table-cell">{p.kind?.toLowerCase() ?? "—"}</td>
                <td className="figure p-2.5 text-right">{brl(p.lastUnitCents)}{p.unit ? <span className="text-xs text-muted"> /{p.unit}</span> : null}</td>
                <td className="figure hidden p-2.5 text-right text-muted sm:table-cell">{p.seenCount}</td>
                <td className="p-1.5"><div className="flex justify-end">
                  <button type="button" aria-label={`Editar ${p.code}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk" onClick={() => setEdit({ id: p.id, code: p.code, description: p.description, kind: p.kind ?? "", unit: p.unit ?? "", price: brl(p.lastUnitCents) })}><Pencil size={14} aria-hidden /></button>
                  <button type="button" aria-label={`Remover ${p.code}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setDel(p)}><Trash2 size={14} aria-hidden /></button>
                </div></td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted">{rows.length ? "Nada encontrado." : "O catálogo está vazio. Ele se enche conforme as cotações forem registradas."}</td></tr>}
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

export function SalesAdmin({ terms, products }: { terms: TermRow[]; products: ProductRow[] }) {
  return <div className="space-y-5"><Terms rows={terms} /><Products rows={products} /></div>;
}
