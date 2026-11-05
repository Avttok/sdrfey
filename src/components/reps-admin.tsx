"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { deleteRepAction, saveRepAction } from "@/modules/reps/actions";

export type RepRow = { id?: number; sapCode: string; repName: string; managerName: string; team: string; cnpj: string; address: string; cep: string; city: string; uf: string; active: boolean };
const EMPTY: RepRow = { sapCode: "", repName: "", managerName: "", team: "", cnpj: "", address: "", cep: "", city: "", uf: "", active: true };

function Card({ r, canEdit, isNew, isAdmin }: { r: RepRow; canEdit: boolean; isNew?: boolean; isAdmin?: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState<boolean>(false);
  const [f, setF] = useState(r);
  const { run, pending } = useRun();
  const field = (k: keyof RepRow, label: string) => <label className="block text-sm"><span className="mb-1 block text-muted">{label}</span><input className={inputCls} disabled={!canEdit} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <li className={`${panelCls} ${f.active ? "" : "opacity-70"}`}>
      <button type="button" className="flex w-full items-center gap-3 p-3.5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        {isNew ? <b className="flex flex-1 items-center gap-2"><Plus size={16} aria-hidden /> Novo representante</b> : (
          <span className="grid min-w-0 flex-1 items-center gap-x-4 gap-y-0.5 md:grid-cols-[minmax(0,2fr)_6rem_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]">
            <b className="truncate">{r.repName}</b>
            <span className="figure w-fit rounded-md bg-sunk px-2 py-0.5 text-xs">SAP {r.sapCode}</span>
            <span className="truncate text-sm text-muted"><span className="md:hidden">Gestor: </span>{r.managerName || "—"}</span>
            <span className="truncate text-sm text-muted"><span className="md:hidden">Equipe: </span>{r.team || "—"}</span>
            <span className="truncate text-sm">{r.city}/{r.uf} {!r.active && <span className="ml-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">inativo</span>}</span>
          </span>
        )}
        <ChevronDown size={18} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {field("repName", "Representante")}{field("sapCode", "Código SAP")}{field("managerName", "Gestor")}{field("team", "Equipe")}{field("cnpj", "CNPJ")}{field("cep", "CEP")}{field("address", "Endereço")}{field("city", "Cidade")}{field("uf", "UF")}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo (inativos não aparecem como “mais próximo”)</label>
          <div className="flex flex-wrap items-center gap-2">
          {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveRepAction({ ...f, id: r.id, managerName: f.managerName || null, team: f.team || null, cnpj: f.cnpj || null, address: f.address || null, cep: f.cep || null }), undefined, () => isNew && setF(EMPTY))}>{isNew ? "Criar" : "Salvar"}</button>}
          {isAdmin && !isNew && !confirmDelete && <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden /> Excluir</button>}
          {isAdmin && !isNew && confirmDelete && (
            <span className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/50 px-3 py-1.5 text-sm">
              <span className="font-medium text-danger">Excluir {r.repName} por completo?</span>
              <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={() => run(() => deleteRepAction(r.id!))}>Sim, excluir</button>
              <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Cancelar</button>
            </span>
          )}
          </div>
        </div>
      )}
    </li>
  );
}
export function RepsAdmin({ rows, canEdit, isAdmin = false }: { rows: RepRow[]; canEdit: boolean; isAdmin?: boolean }) {
  return <ul className="space-y-2">{canEdit && <Card isNew canEdit r={EMPTY} />}{rows.map((r) => <Card key={r.id} r={r} canEdit={canEdit} isAdmin={isAdmin} />)}</ul>;
}
