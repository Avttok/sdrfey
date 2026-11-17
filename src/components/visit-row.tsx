"use client";

import { ExternalLink, MapPin, Pencil, Trash2, X, Check } from "lucide-react";
import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { PersonBubble } from "@/components/person-bubble";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { updateVisitAction } from "@/modules/leads/edit";
import type { LeadView } from "@/modules/leads/view";

export type VisitItem = LeadView["visits"][number];

/** Uma visita do lead: dados, representante mais próximo, link do Salesforce e edição na própria linha. */
export function VisitRow({ leadId, v, canManage, onDelete }: { leadId: number; v: VisitItem; canManage: boolean; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "" });
  const { run, pending } = useRun();

  if (editing) {
    return (
      <li className="space-y-3 rounded-xl border-2 border-accent/40 bg-sunk px-3 py-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-muted">Código</span><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
          <div className="block"><span className="mb-1 block text-muted">Data da visita</span><DateInput label="Data da visita" value={f.date} onChange={(d) => setF({ ...f, date: d })} /></div>
          <label className="block sm:col-span-2"><span className="mb-1 block text-muted">Link da visita (Salesforce, opcional)</span><input className={inputCls} placeholder="https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateVisitAction(leadId, v.id, { code: f.code, visitDate: f.date, link: f.link || null }), undefined, () => setEditing(false))}><Check size={15} aria-hidden /> Salvar</button>
          <button type="button" className={btnGhost} disabled={pending} onClick={() => { setEditing(false); setF({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "" }); }}><X size={15} aria-hidden /> Cancelar</button>
        </div>
      </li>
    );
  }
  return (
    <li className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl bg-sunk px-3 py-2.5 text-sm ${v.canceled ? "opacity-60" : ""}`}>
      <span className="rounded-md bg-grad px-2 py-0.5 text-xs font-bold text-on-accent">{v.code}</span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block font-medium">{v.visitDate ? `Visita em ${fmtDate(v.visitDate)}` : "Sem data de visita"}{v.canceled && <span className="ml-2 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">Cancelada</span>}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">Agendada em {fmtDateTime(v.at)}{v.by && v.byHex && <>&nbsp;por <PersonBubble name={v.by} hex={v.byHex} /></>}</span>
        {v.repName && <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted"><MapPin size={12} aria-hidden /> Representante mais próximo: <b className="font-medium text-ink">{v.repName}</b>{v.repSap ? ` · SAP ${v.repSap}` : ""}{v.repCity ? ` · ${v.repCity}` : ""}{v.repKm != null ? ` · ${v.repKm} km` : ""}</span>}
        {v.link && <a href={v.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent underline"><ExternalLink size={12} aria-hidden /> Abrir visita no Salesforce</a>}
      </span>
      {canManage && (
        <span className="flex gap-1">
          <button type="button" aria-label={`Editar visita ${v.code}`} title="Editar visita" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden /></button>
          <button type="button" aria-label={`Apagar visita ${v.code}`} title="Apagar visita" className="grid size-8 place-items-center rounded-lg text-danger transition hover:bg-danger/10" onClick={onDelete}><Trash2 size={16} aria-hidden /></button>
        </span>
      )}
    </li>
  );
}
