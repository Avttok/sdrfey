"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { CalendarCheck, Eye, ExternalLink, MapPin, Pencil, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyVal } from "@/components/copy-val";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { deleteRepAction, saveRepAction } from "@/modules/reps/actions";

export type RepRow = { id?: number; sapCode: string; repName: string; managerName: string; team: string; cnpj: string; address: string; cep: string; city: string; uf: string; active: boolean; visits?: number; lastVisit?: string | null };
const EMPTY: RepRow = { sapCode: "", repName: "", managerName: "", team: "", cnpj: "", address: "", cep: "", city: "", uf: "", active: true };

/** Visão só de leitura: tudo do representante, com copiar e mapa. */
function ReadOnly({ r }: { r: RepRow }) {
  const item = (label: string, v: string | null | undefined, copy = false) => <div className="rounded-xl bg-sunk px-3.5 py-2.5"><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 text-sm font-medium">{v ? (copy ? <CopyVal text={v}>{v}</CopyVal> : v) : <span className="font-normal text-muted">—</span>}</dd></div>;
  const addr = [r.address, r.cep, r.city && `${r.city}/${r.uf}`].filter(Boolean).join(", ");
  return (
    <div className="space-y-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        {item("Código SAP", r.sapCode, true)}{item("CNPJ", r.cnpj, true)}{item("Gestor", r.managerName)}{item("Equipe", r.team)}
        {item("Cidade / UF", r.city ? `${r.city}/${r.uf}` : "")}{item("CEP", r.cep, true)}
        <div className="sm:col-span-2">{item("Endereço", r.address, true)}</div>
        {item("Situação", r.active ? "Ativo (pode ser o mais próximo de um lead)" : "Inativo (não aparece como mais próximo)")}
        {item("Visitas agendadas com ele", `${r.visits ?? 0}${r.lastVisit ? ` · última em ${new Date(r.lastVisit).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}`)}
      </dl>
      {addr && <a className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}><ExternalLink size={14} aria-hidden /> Ver no mapa</a>}
    </div>
  );
}

/** Janela de edição/criação de representante. */
function Editor({ r, canEdit, isAdmin, onClose }: { r: RepRow; canEdit: boolean; isAdmin: boolean; onClose: () => void }) {
  const isNew = r.id === undefined;
  const [f, setF] = useState(r);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const field = (k: keyof RepRow, label: string, span = "") => <label className={`block text-sm ${span}`}><span className="mb-1 block text-muted">{label}</span><input className={inputCls} disabled={!canEdit} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={isNew ? "Novo representante" : `Representante ${r.repName}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${panelCls} max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto p-6 shadow-2xl`}>
        {dialog}
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-grad-soft text-accent">{isNew ? <Plus size={20} aria-hidden /> : <UserRound size={20} aria-hidden />}</span>
          <div className="flex-1"><h2 className="display text-xl">{isNew ? "Novo representante" : r.repName}</h2>{!isNew && <p className="text-xs text-muted">SAP {r.sapCode}</p>}</div>
          <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={18} /></button>
        </div>
        {!canEdit && !isNew ? <ReadOnly r={r} /> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("repName", "Representante")}{field("sapCode", "Código SAP")}{field("managerName", "Gestor")}{field("team", "Equipe")}{field("cnpj", "CNPJ")}{field("cep", "CEP")}{field("address", "Endereço", "sm:col-span-2")}{field("city", "Cidade")}{field("uf", "UF")}
        </div>
        <label className="flex items-center gap-2.5 rounded-xl bg-sunk px-3.5 py-2.5 text-sm"><input type="checkbox" className="size-4" disabled={!canEdit} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> <span><b className="font-medium">Ativo</b> <span className="text-muted">· inativos não aparecem como “mais próximo”</span></span></label></>}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveRepAction({ ...f, id: r.id, managerName: f.managerName || null, team: f.team || null, cnpj: f.cnpj || null, address: f.address || null, cep: f.cep || null }), undefined, onClose)}>{isNew ? "Criar representante" : "Salvar"}</button>}
          <span className="flex-1" />
          {isAdmin && !isNew && <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir este representante?", body: `${r.repName} será excluído por completo. Visitas já agendadas guardam a cópia dos dados dele.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteRepAction(r.id!)) })}><Trash2 size={15} aria-hidden /> Excluir</button>}
        </div>
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
        {rows.map((r, i) => {
          const hue = [...(r.repName || "x")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
          const addr = [r.address, r.cep, r.city && `${r.city}/${r.uf}`].filter(Boolean).join(", ");
          return (
          <li key={r.id} style={{ "--i": i % 12 } as React.CSSProperties} className={`${panelCls} card-in lift group flex flex-col overflow-hidden ${r.active ? "" : "opacity-70"}`}>
            <div aria-hidden className="relative h-14" style={{ background: `linear-gradient(120deg, hsl(${hue} 70% 55% / .85), hsl(${(hue + 50) % 360} 70% 50% / .75))` }}>
              <span className="absolute -right-4 -top-6 size-24 rounded-full bg-white/20 blur-xl" />
              <span className="absolute bottom-1.5 right-3 flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"><CalendarCheck size={11} aria-hidden /><span className="figure">{r.visits ?? 0}</span> {(r.visits ?? 0) === 1 ? "visita" : "visitas"}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
              <div className="-mt-7 flex items-start justify-between gap-3">
                <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl border-4 border-panel text-base font-bold text-white shadow-md" style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 48%), hsl(${(hue + 40) % 360} 65% 42%))` }}>{(r.repName || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
                <button type="button" aria-label={canEdit ? `Editar ${r.repName}` : `Ver detalhes de ${r.repName}`} title={canEdit ? "Editar" : "Ver detalhes"} className="mt-9 rounded-xl border border-line p-2 text-muted transition hover:border-accent/50 hover:bg-accent/10 hover:text-accent" onClick={() => setEdit(r)}>{canEdit ? <Pencil size={16} /> : <Eye size={16} />}</button>
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">{r.repName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"><span className="figure rounded-md bg-sunk px-1.5 py-0.5">SAP {r.sapCode}</span>{!r.active && <span className="rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger">inativo</span>}</p>
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-accent" aria-hidden /><dd className="truncate">{r.city ? `${r.city}/${r.uf}` : "—"}</dd></div>
                <div className="flex items-center gap-2"><Users size={14} className="shrink-0 text-accent" aria-hidden /><dd className="truncate text-muted">{[r.managerName && `Gestor ${r.managerName}`, r.team].filter(Boolean).join(" · ") || "Sem gestor/equipe"}</dd></div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
                <span className="text-muted">{r.lastVisit ? `Última visita ${new Date(r.lastVisit).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Sem visitas ainda"}</span>
                <span className="flex items-center gap-1">
                  {addr && <a className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-accent transition hover:bg-accent/10" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}><ExternalLink size={12} aria-hidden /> Mapa</a>}
                  <button type="button" className="rounded-full px-2.5 py-1 font-semibold text-accent transition hover:bg-accent/10" onClick={() => setEdit(r)}>{canEdit ? "Editar" : "Detalhes"}</button>
                </span>
              </div>
            </div>
          </li>
          );
        })}
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
