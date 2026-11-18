"use client";

import { EoxIcon, SalesforceIcon } from "@/components/brand-icons";
import { CalendarDays, Check, CheckCircle2, Clock, ExternalLink, MapPin, Pencil, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { PersonBubble } from "@/components/person-bubble";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { setVisitStatusAction, updateVisitAction } from "@/modules/leads/edit";
import type { LeadView } from "@/modules/leads/view";

export type VisitItem = LeadView["visits"][number];

const STATUS = {
  pendente: { label: "Aguardando confirmação", cls: "bg-warn/15 text-warn", Icon: Clock },
  confirmada: { label: "Confirmada", cls: "bg-accent/15 text-accent", Icon: CheckCircle2 },
  realizada: { label: "Realizada", cls: "bg-ok/15 text-ok", Icon: CheckCircle2 },
  cancelada: { label: "Cancelada", cls: "bg-danger/15 text-danger", Icon: X },
} as const;

export function VisitCodeChip({ code }: { code: string }) {
  return <span className="inline-flex h-7 min-w-[5.5rem] items-center justify-center rounded-lg bg-grad px-2.5 font-mono text-[13px] font-bold tracking-wide text-on-accent">{code}</span>;
}

export function VisitStatusChip({ status }: { status: keyof typeof STATUS }) {
  const { label, cls, Icon } = STATUS[status];
  return <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${cls}`}><Icon size={12} aria-hidden />{label}</span>;
}

/** Uma visita do lead. Cabeçalho numa linha só (código, data, andamento, ações), detalhes embaixo alinhados em colunas. */
export function VisitRow({ leadId, v, canManage, onDelete }: { leadId: number; v: VisitItem; canManage: boolean; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "" });
  const { run, pending } = useRun();

  if (editing) {
    return (
      <li className="space-y-3 rounded-xl border-2 border-accent/40 bg-sunk p-3.5 text-sm">
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
  const next = v.status === "pendente" ? "confirmada" : v.status === "confirmada" ? "realizada" : null;
  return (
    <li className={`overflow-hidden rounded-xl border border-line bg-sunk text-sm ${v.canceled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
        <VisitCodeChip code={v.code} />
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-medium"><CalendarDays size={15} className="shrink-0 text-muted" aria-hidden /><span className="truncate">{v.visitDate ? fmtDate(v.visitDate) : "Sem data"}</span></span>
        <VisitStatusChip status={v.status} />
        {canManage && (
          <span className="flex items-center gap-1">
            <button type="button" aria-label={`Editar visita ${v.code}`} title="Editar visita" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-ink" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden /></button>
            <button type="button" aria-label={`Apagar visita ${v.code}`} title="Apagar visita" className="grid size-8 place-items-center rounded-lg text-danger transition hover:bg-danger/10" onClick={onDelete}><Trash2 size={16} aria-hidden /></button>
          </span>
        )}
      </div>
      <dl className="grid gap-x-6 gap-y-1.5 border-t border-line bg-panel/50 px-3.5 py-2.5 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="inline-flex items-center gap-1.5 text-muted"><UserRound size={12} aria-hidden /> Agendada</dt>
        <dd className="flex flex-wrap items-center gap-1.5"><span>{fmtDateTime(v.at)}</span>{v.by && v.byHex && <><span className="text-muted">por</span><PersonBubble name={v.by} hex={v.byHex} /></>}</dd>
        {v.kind === "seller" && <>
          <dt className="inline-flex items-center gap-1.5 text-muted"><UserRound size={12} aria-hidden /> Vendedores SDR</dt>
          <dd><b className="font-semibold">{v.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce e confirma</dd>
        </>}
        {v.repName && <>
          <dt className="inline-flex items-center gap-1.5 text-muted"><MapPin size={12} aria-hidden /> Representante</dt>
          <dd><b className="font-semibold">{v.repName}</b>{v.repSap ? ` · SAP ${v.repSap}` : ""}{v.repCity ? ` · ${v.repCity}` : ""}{v.repKm != null ? ` · ${v.repKm} km` : ""}</dd>
        </>}
        {v.confirmedAt && !v.canceled && <>
          <dt className="inline-flex items-center gap-1.5 text-muted"><CheckCircle2 size={12} aria-hidden /> Confirmada</dt>
          <dd>{fmtDateTime(v.confirmedAt)}</dd>
        </>}
        {v.link && <>
          <dt className="inline-flex items-center gap-1.5 text-muted"><SalesforceIcon size={12} /> Salesforce</dt>
          <dd><a href={v.link} target="_blank" rel="noreferrer" className="font-medium text-accent underline">Abrir visita</a></dd>
        </>}
      </dl>
      {canManage && !v.canceled && (next || v.status !== "pendente") && (
        <div className="flex flex-wrap gap-2 border-t border-line px-3.5 py-2">
          {next && <button type="button" disabled={pending} className={`${btnGhost} !py-1 !text-xs`} onClick={() => run(() => setVisitStatusAction(leadId, v.id, next))}><Check size={13} aria-hidden /> {next === "confirmada" ? "Marcar como confirmada" : "Marcar como realizada"}</button>}
          {v.status !== "pendente" && <button type="button" disabled={pending} className={`${btnGhost} !py-1 !text-xs`} onClick={() => run(() => setVisitStatusAction(leadId, v.id, "pendente"))}>Voltar para aguardando</button>}
        </div>
      )}
    </li>
  );
}
