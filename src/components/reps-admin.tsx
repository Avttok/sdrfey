"use client";

import { MapPin, Pencil, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { deleteRepAction, saveRepAction } from "@/modules/reps/actions";

export type RepRow = { id?: number; sapCode: string; repName: string; managerName: string; team: string; cnpj: string; address: string; cep: string; city: string; uf: string; active: boolean };
const EMPTY: RepRow = { sapCode: "", repName: "", managerName: "", team: "", cnpj: "", address: "", cep: "", city: "", uf: "", active: true };

/** Janela de edição/criação de representante. */
function Editor({ r, canEdit, isAdmin, onClose }: { r: RepRow; canEdit: boolean; isAdmin: boolean; onClose: () => void }) {
  const isNew = r.id === undefined;
  const [f, setF] = useState(r);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useRun();
  const field = (k: keyof RepRow, label: string, span = "") => <label className={`block text-sm ${span}`}><span className="mb-1 block text-muted">{label}</span><input className={inputCls} disabled={!canEdit} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={isNew ? "Novo representante" : `Representante ${r.repName}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${panelCls} max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto p-6 shadow-2xl`}>
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-grad-soft text-accent">{isNew ? <Plus size={20} aria-hidden /> : <UserRound size={20} aria-hidden />}</span>
          <div className="flex-1"><h2 className="display text-xl">{isNew ? "Novo representante" : r.repName}</h2>{!isNew && <p className="text-xs text-muted">SAP {r.sapCode}</p>}</div>
          <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("repName", "Representante")}{field("sapCode", "Código SAP")}{field("managerName", "Gestor")}{field("team", "Equipe")}{field("cnpj", "CNPJ")}{field("cep", "CEP")}{field("address", "Endereço", "sm:col-span-2")}{field("city", "Cidade")}{field("uf", "UF")}
        </div>
        <label className="flex items-center gap-2.5 rounded-xl bg-sunk px-3.5 py-2.5 text-sm"><input type="checkbox" className="size-4" disabled={!canEdit} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> <span><b className="font-medium">Ativo</b> <span className="text-muted">· inativos não aparecem como “mais próximo”</span></span></label>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveRepAction({ ...f, id: r.id, managerName: f.managerName || null, team: f.team || null, cnpj: f.cnpj || null, address: f.address || null, cep: f.cep || null }), undefined, onClose)}>{isNew ? "Criar representante" : "Salvar"}</button>}
          <span className="flex-1" />
          {isAdmin && !isNew && !confirmDelete && <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden /> Excluir</button>}
        </div>
        {isAdmin && !isNew && confirmDelete && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/50 bg-danger/5 p-3 text-sm">
            <span className="flex-1 font-medium text-danger">Excluir {r.repName} por completo?</span>
            <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={() => run(() => deleteRepAction(r.id!))}>Sim, excluir</button>
            <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function RepsAdmin({ rows, canEdit, isAdmin = false }: { rows: RepRow[]; canEdit: boolean; isAdmin?: boolean }) {
  const [edit, setEdit] = useState<RepRow | null>(null);
  useEffect(() => {
    const open = () => setEdit(EMPTY);
    window.addEventListener("rep:new", open);
    return () => window.removeEventListener("rep:new", open);
  }, []);
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className={`${panelCls} flex flex-col gap-3 p-4 transition hover:border-accent/50 hover:shadow-md ${r.active ? "" : "opacity-70"}`}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-sm font-bold text-accent">{(r.repName || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.repName}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted"><span className="figure rounded-md bg-sunk px-1.5 py-0.5">SAP {r.sapCode}</span>{!r.active && <span className="rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger">inativo</span>}</p>
              </div>
              {canEdit ? <button type="button" aria-label={`Editar ${r.repName}`} className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-accent" onClick={() => setEdit(r)}><Pencil size={16} /></button> : null}
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-muted" aria-hidden /><dd className="truncate">{r.city ? `${r.city}/${r.uf}` : "—"}</dd></div>
              <div className="flex items-center gap-2"><Users size={14} className="shrink-0 text-muted" aria-hidden /><dd className="truncate text-muted">{[r.managerName && `Gestor ${r.managerName}`, r.team].filter(Boolean).join(" · ") || "Sem gestor/equipe"}</dd></div>
            </dl>
          </li>
        ))}
        {rows.length === 0 && <li className={`${panelCls} p-10 text-center text-muted md:col-span-2 xl:col-span-3`}>Nenhum representante com esses filtros.</li>}
      </ul>
      {edit && <Editor key={edit.id ?? "novo"} r={edit} canEdit={canEdit} isAdmin={isAdmin} onClose={() => setEdit(null)} />}
    </>
  );
}

/** Botão do cabeçalho da página: abre a janela de novo representante. */
export function NewRepButton() {
  return <button type="button" className={`${btnPrimary} shadow-md`} onClick={() => window.dispatchEvent(new Event("rep:new"))}><Plus size={17} aria-hidden /> Novo representante</button>;
}
