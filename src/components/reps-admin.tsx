"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { saveRepAction } from "@/modules/reps/actions";

export type RepRow = { id?: number; sapCode: string; repName: string; managerName: string; team: string; cnpj: string; address: string; cep: string; city: string; uf: string; active: boolean };
const EMPTY: RepRow = { sapCode: "", repName: "", managerName: "", team: "", cnpj: "", address: "", cep: "", city: "", uf: "", active: true };

function Card({ r, canEdit, isNew }: { r: RepRow; canEdit: boolean; isNew?: boolean }) {
  const [open, setOpen] = useState<boolean>(false);
  const [f, setF] = useState(r);
  const { run, pending } = useRun();
  const field = (k: keyof RepRow, label: string) => <label className="block text-sm"><span className="mb-1 block text-muted">{label}</span><input className={inputCls} disabled={!canEdit} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <li className={`${panelCls} ${f.active ? "" : "opacity-70"}`}>
      <button type="button" className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex-1">{isNew ? <b className="flex items-center gap-2"><Plus size={16} aria-hidden /> Novo representante</b> : <><b>{r.repName}</b> <span className="text-xs text-muted">SAP {r.sapCode} · {r.city}/{r.uf}{r.active ? "" : " · inativo"}</span></>}</span>
        <ChevronDown size={18} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {field("repName", "Representante")}{field("sapCode", "Código SAP")}{field("managerName", "Gestor")}{field("team", "Equipe")}{field("cnpj", "CNPJ")}{field("cep", "CEP")}{field("address", "Endereço")}{field("city", "Cidade")}{field("uf", "UF")}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo (inativos não aparecem como “mais próximo”)</label>
          {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveRepAction({ ...f, id: r.id, managerName: f.managerName || null, team: f.team || null, cnpj: f.cnpj || null, address: f.address || null, cep: f.cep || null }), undefined, () => isNew && setF(EMPTY))}>{isNew ? "Criar" : "Salvar"}</button>}
        </div>
      )}
    </li>
  );
}
export function RepsAdmin({ rows, canEdit }: { rows: RepRow[]; canEdit: boolean }) {
  return <ul className="space-y-2">{canEdit && <Card isNew canEdit r={EMPTY} />}{rows.map((r) => <Card key={r.id} r={r} canEdit={canEdit} />)}</ul>;
}
