"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { CalendarCheck, Eye, ExternalLink, IdCard, MapPin, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyVal } from "@/components/copy-val";
import { Block, Modal } from "@/components/modal";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { deleteRepAction, saveRepAction } from "@/modules/reps/actions";

export type RepRow = { id?: number; sapCode: string; repName: string; managerName: string; team: string; cnpj: string; address: string; cep: string; city: string; uf: string; active: boolean; visits?: number; lastVisit?: string | null };
const EMPTY: RepRow = { sapCode: "", repName: "", managerName: "", team: "", cnpj: "", address: "", cep: "", city: "", uf: "", active: true };

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const mapsUrl = (r: RepRow) => { const addr = [r.address, r.cep, r.city && `${r.city}/${r.uf}`].filter(Boolean).join(", "); return addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : null; };

/** Visão só de leitura: tudo do representante, com copiar e mapa. */
function ReadOnly({ r }: { r: RepRow }) {
  const item = (label: string, v: string | null | undefined, copy = false) => <div className="min-w-0 rounded-xl bg-panel px-3.5 py-2.5 ring-1 ring-line"><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium">{v ? (copy ? <CopyVal text={v}>{v}</CopyVal> : v) : <span className="font-normal text-muted">—</span>}</dd></div>;
  const map = mapsUrl(r);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Block title="Identificação" icon={IdCard}><dl className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">{item("Código SAP", r.sapCode, true)}{item("CNPJ", r.cnpj, true)}{item("Gestor", r.managerName)}{item("Equipe", r.team)}</dl></Block>
      <Block title="Localização" icon={MapPin}>
        <dl className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">{item("Cidade / UF", r.city ? `${r.city}/${r.uf}` : "")}{item("CEP", r.cep, true)}<div className="sm:col-span-2 md:col-span-1 xl:col-span-2">{item("Endereço", r.address, true)}</div></dl>
        {map && <a className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline" target="_blank" rel="noopener noreferrer" href={map}><ExternalLink size={14} aria-hidden /> Ver no mapa</a>}
      </Block>
      <Block title="Situação e visitas" icon={CalendarCheck} className="md:col-span-2">
        <dl className="grid gap-2 sm:grid-cols-2">{item("Situação", r.active ? "Ativo (pode ser o mais próximo de um lead)" : "Inativo (não aparece como mais próximo)")}{item("Visitas agendadas com ele", `${r.visits ?? 0}${r.lastVisit ? ` · última em ${fmtDay(r.lastVisit)}` : ""}`)}</dl>
      </Block>
    </div>
  );
}

/** Janela de edição/criação de representante. */
function Editor({ r, canEdit, isAdmin, onClose }: { r: RepRow; canEdit: boolean; isAdmin: boolean; onClose: () => void }) {
  const isNew = r.id === undefined;
  const [f, setF] = useState(r);
  const dirty = JSON.stringify(f) !== JSON.stringify(r);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const field = (k: keyof RepRow, label: string, opt: { span?: string; hint?: string; mono?: boolean; max?: number } = {}) => (
    <label className={`block text-sm ${opt.span ?? ""}`}><span className="mb-1 flex items-baseline justify-between gap-2 text-xs font-medium text-muted"><span>{label}</span>{opt.hint && <span className="font-normal">{opt.hint}</span>}</span>
      <input className={`${inputCls} ${opt.mono ? "figure" : ""}`} disabled={!canEdit} maxLength={opt.max} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: k === "uf" ? e.target.value.toUpperCase() : e.target.value })} /></label>
  );
  const readOnly = !canEdit && !isNew;
  const missing = !f.repName.trim() || !f.sapCode.trim();
  return (
    <Modal onClose={onClose} locked={dirty} size="lg" icon={isNew ? Plus : UserRound}
      title={isNew ? "Novo representante" : r.repName} subtitle={isNew ? "Preencha o básico; o resto pode ficar para depois." : `SAP ${r.sapCode}${r.city ? ` · ${r.city}/${r.uf}` : ""}`}
      badges={!isNew && <><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.active ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{r.active ? "Ativo" : "Inativo"}</span><span className="rounded-full bg-sunk px-2.5 py-0.5 text-xs font-semibold text-muted"><span className="figure">{r.visits ?? 0}</span> {(r.visits ?? 0) === 1 ? "visita" : "visitas"}</span></>}
      footer={<>
        {dialog}
        {canEdit && <button type="button" className={btnPrimary} disabled={pending || missing || (!isNew && !dirty)} onClick={() => run(() => saveRepAction({ ...f, id: r.id, managerName: f.managerName || null, team: f.team || null, cnpj: f.cnpj || null, address: f.address || null, cep: f.cep || null }), undefined, onClose)}>{isNew ? "Criar representante" : "Salvar alterações"}</button>}
        <button type="button" className={btnGhost} onClick={onClose}>{readOnly ? "Fechar" : "Cancelar"}</button>
        {canEdit && dirty && <span className="text-xs text-warn">Alterações não salvas</span>}
        {canEdit && missing && <span className="text-xs text-muted">Nome e código SAP são obrigatórios</span>}
        <span className="flex-1" />
        {isAdmin && !isNew && <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir este representante?", body: `${r.repName} será excluído por completo. Visitas já agendadas guardam a cópia dos dados dele.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteRepAction(r.id!)) })}><Trash2 size={15} aria-hidden /> Excluir</button>}
      </>}>
      {readOnly ? <ReadOnly r={r} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          <Block title="Identificação" icon={IdCard}><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">{field("repName", "Representante", { span: "sm:col-span-2 md:col-span-1 xl:col-span-2" })}{field("sapCode", "Código SAP", { mono: true })}{field("cnpj", "CNPJ", { mono: true })}{field("managerName", "Gestor")}{field("team", "Equipe")}</div></Block>
          <Block title="Localização" icon={MapPin}><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">{field("address", "Endereço", { span: "sm:col-span-2 md:col-span-1 xl:col-span-2" })}{field("cep", "CEP", { mono: true })}{field("uf", "UF", { max: 2 })}{field("city", "Cidade", { span: "sm:col-span-2 md:col-span-1 xl:col-span-2" })}</div></Block>
          <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition md:col-span-2 ${f.active ? "border-ok/40 bg-ok/10" : "border-line bg-sunk/40"}`}>
            <span><b className="block text-sm font-semibold">{f.active ? "Representante ativo" : "Representante inativo"}</b><span className="text-xs text-muted">Inativos não aparecem como “mais próximo” nos leads e nas visitas.</span></span>
            <input type="checkbox" role="switch" className="peer sr-only" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition ${f.active ? "bg-ok" : "bg-line"} after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform ${f.active ? "after:translate-x-5" : ""}`} />
          </label>
          {!isNew && mapsUrl(f) && <a className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline md:col-span-2" target="_blank" rel="noopener noreferrer" href={mapsUrl(f)!}><ExternalLink size={14} aria-hidden /> Ver no mapa</a>}
        </div>
      )}
    </Modal>
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
