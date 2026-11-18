"use client";

import Link from "next/link";
import { CalendarCheck, Check, CheckCircle2, Clock, Mail, MapPin, Pencil, Phone, Save, StickyNote, UserRound, UserRoundCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandLink, SalesforceIcon } from "@/components/brand-icons";
import { PersonBubble } from "@/components/person-bubble";
import { VisitCodeChip, VisitStatusChip } from "@/components/visit-row";
import { DateInput } from "@/components/date-input";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { setVisitStatusAction, updateVisitAction } from "@/modules/leads/edit";
import { fmtDate, fmtDateTime } from "@/lib/format";

export type VisitCard = {
  id: number; code: string; status: "pendente" | "confirmada" | "realizada" | "cancelada"; canceled: boolean; kind: "rep" | "seller";
  visitDate: string | null; link: string | null; at: string; note: string | null; confirmedAt: string | null;
  repName: string | null; repSap: string | null; repCity: string | null; repKm: number | null; sellerName: string | null;
  leadId: number; company: string; city: string | null; uf: string | null; sfUrl: string | null; eoxUrl: string | null;
  by: { name: string; hex: string } | null;
  cnpj: string | null; phones: string[]; email: string | null; contactName: string | null; roleTitle: string | null; canManage: boolean;
};

/** Lista de visitas em cartões; clicar abre o popup com tudo da visita (sem sair da tela). */
export function VisitCards({ list, openId }: { list: VisitCard[]; openId?: number | null }) {
  const [open, setOpen] = useState<number | null>(openId ?? null);
  const v = list.find((x) => x.id === open) ?? null;
  const set = (id: number | null) => {
    setOpen(id);
    try { const u = new URL(location.href); id ? u.searchParams.set("v", String(id)) : u.searchParams.delete("v"); history.replaceState(null, "", u); } catch { /* sem URL */ }
  };
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => set(c.id)} className={`${panelCls} group relative block h-full w-full overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg ${c.canceled ? "opacity-60" : ""}`}>
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-grad" />
              <div className="flex items-center justify-between gap-3">
                <VisitCodeChip code={c.code} />
                <VisitStatusChip status={c.canceled ? "cancelada" : c.status} />
              </div>
              <p className="mt-3 font-semibold leading-snug">{c.company}</p>
              {(c.city || c.uf) && <p className="text-sm text-muted">{[c.city, c.uf].filter(Boolean).join(" / ")}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium"><CalendarCheck size={15} className="text-accent" aria-hidden /> {c.visitDate ? `Visita em ${fmtDate(c.visitDate)}` : "Data da visita não informada"}</p>
              {c.kind === "seller" && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted"><UserRoundCheck size={13} className="mt-0.5 shrink-0" aria-hidden /><span>Vendedores SDR: <b className="font-medium text-ink">{c.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce</span></p>}
              {c.repName && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden /><span>Representante: <b className="font-medium text-ink">{c.repName}</b>{c.repKm != null ? ` · ${c.repKm} km` : ""}{c.repCity ? ` · ${c.repCity}` : ""}</span></p>}
              {c.link && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#0070d2" }}><SalesforceIcon size={12} /> Tem link do Salesforce</span>}
              {c.note && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.note}</p>}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                {c.by ? <span className="flex min-w-0 items-center gap-2"><span className="text-muted/80">Agendada por</span><PersonBubble name={c.by.name} hex={c.by.hex} /></span> : <span />}
                <span className="shrink-0 whitespace-nowrap">em {fmtDateTime(c.at)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {v && <VisitDialog v={v} onClose={() => set(null)} />}
    </>
  );
}

function Row({ icon: I, label, children }: { icon: typeof UserRound; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 py-2 text-sm">
      <dt className="inline-flex items-center gap-1.5 text-muted"><I size={14} aria-hidden /> {label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const dayDiff = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(new Date().toDateString() + " 12:00:00").getTime()) / 86_400_000);
const fmtCnpj = (d: string) => (d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d);
const fmtPhone = (d: string) => (d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : d.length === 10 ? d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : d);

/** Popup da visita: tudo sobre a visita e o cliente; quem pode, edita e confirma sem sair da tela. */
function VisitDialog({ v, onClose }: { v: VisitCard; onClose: () => void }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "", note: v.note ?? "" });
  const { run, pending } = useRun();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !editing) closeRef.current(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [editing]);
  const status = v.canceled ? "cancelada" : v.status;
  const next = v.status === "pendente" ? "confirmada" : v.status === "confirmada" ? "realizada" : null;
  const d = v.visitDate ? dayDiff(v.visitDate) : null;
  const when = d === null ? null : d === 0 ? { t: "Hoje", cls: "text-accent" } : d === 1 ? { t: "Amanhã", cls: "text-accent" } : d > 1 ? { t: `Em ${d} dias`, cls: "text-ink" } : { t: `${-d} ${-d === 1 ? "dia" : "dias"} atrás`, cls: v.status === "realizada" ? "text-muted" : "text-warn" };
  const steps = [
    { k: "Agendada", at: v.at, done: true },
    { k: "Confirmada", at: v.confirmedAt, done: v.status === "confirmada" || v.status === "realizada" },
    { k: "Realizada", at: null, done: v.status === "realizada" },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Visita ${v.code}`} onClick={(e) => { if (e.target === e.currentTarget && !editing) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><VisitCodeChip code={v.code} /><VisitStatusChip status={status} />{when && <span className={`text-sm font-semibold ${when.cls}`}>{when.t}</span>}</div>
            <h2 className="display break-words text-2xl">{v.company}</h2>
            <p className="text-sm text-muted">{[v.city && v.uf ? `${v.city} / ${v.uf}` : v.city || v.uf, v.cnpj ? `CNPJ ${fmtCnpj(v.cnpj)}` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={18} /></button>
        </div>

        {!v.canceled && (
          <ol className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-sunk/40 p-3 text-center text-xs">
            {steps.map((st) => (
              <li key={st.k} className={st.done ? "text-ink" : "text-muted"}>
                <span className={`mx-auto mb-1 grid size-7 place-items-center rounded-full ${st.done ? "bg-ok text-white" : "bg-sunk"}`}>{st.done ? <Check size={14} aria-hidden /> : <Clock size={13} aria-hidden />}</span>
                <b className="block font-semibold">{st.k}</b>
                <span className="block text-muted">{st.at ? fmtDateTime(st.at) : st.done ? "" : "—"}</span>
              </li>
            ))}
          </ol>
        )}

        {editing ? (
          <div className="space-y-3 rounded-xl border-2 border-accent/40 bg-sunk p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-muted">Código</span><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
              <div className="block"><span className="mb-1 block text-muted">Data da visita</span><DateInput label="Data da visita" value={f.date} onChange={(x) => setF({ ...f, date: x })} /></div>
              <label className="block sm:col-span-2"><span className="mb-1 block text-muted">Link da visita (Salesforce, opcional)</span><input className={inputCls} placeholder="https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-muted">Observação</span><textarea className={`${inputCls} min-h-24`} maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateVisitAction(v.leadId, v.id, { code: f.code, visitDate: f.date, link: f.link || null, note: f.note }), "Visita atualizada.", () => { setEditing(false); onClose(); })}><Save size={15} aria-hidden /> Salvar alterações</button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => { setEditing(false); setF({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "", note: v.note ?? "" }); }}><X size={15} aria-hidden /> Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <dl className="divide-y divide-line rounded-xl border border-line bg-sunk/40 px-3.5">
              <Row icon={CalendarCheck} label="Data da visita"><b className="font-semibold">{v.visitDate ? fmtDate(v.visitDate) : "Não informada"}</b></Row>
              <Row icon={UserRound} label="Agendada">{fmtDateTime(v.at)}{v.by && <> <span className="text-muted">por</span> <PersonBubble name={v.by.name} hex={v.by.hex} /></>}</Row>
              {v.kind === "seller" && <Row icon={UserRoundCheck} label="Vendedores SDR"><b className="font-semibold">{v.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce e confirma</Row>}
              {v.repName && <Row icon={MapPin} label="Representante"><b className="font-semibold">{v.repName}</b>{v.repSap ? ` · SAP ${v.repSap}` : ""}{v.repCity ? ` · ${v.repCity}` : ""}{v.repKm != null ? ` · ${v.repKm} km` : ""}</Row>}
              {v.confirmedAt && !v.canceled && <Row icon={UserRoundCheck} label="Confirmada">{fmtDateTime(v.confirmedAt)}</Row>}
              <Row icon={StickyNote} label="Observação">{v.note ? <span className="whitespace-pre-wrap">{v.note}</span> : <span className="text-muted">Sem observação</span>}</Row>
            </dl>
            <dl className="divide-y divide-line rounded-xl border border-line bg-sunk/40 px-3.5">
              <Row icon={UserRound} label="Contato">{v.contactName ? <><b className="font-semibold">{v.contactName}</b>{v.roleTitle ? <span className="text-muted"> · {v.roleTitle}</span> : null}</> : <span className="text-muted">Sem contato cadastrado</span>}</Row>
              <Row icon={Phone} label="Telefones">{v.phones.length ? <span className="flex flex-wrap gap-x-3 gap-y-1">{v.phones.slice(0, 4).map((t) => <a key={t} href={`tel:+55${t}`} className="font-medium hover:underline">{fmtPhone(t)}</a>)}</span> : <span className="text-muted">—</span>}</Row>
              <Row icon={Mail} label="E-mail">{v.email ? <a href={`mailto:${v.email}`} className="break-all font-medium hover:underline">{v.email}</a> : <span className="text-muted">—</span>}</Row>
              <Row icon={MapPin} label="Local">{[v.city, v.uf].filter(Boolean).join(" / ") || "—"}</Row>
            </dl>
          </div>
        )}

        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            {v.link && <BrandLink kind="sf" href={v.link} label="Abrir visita" />}
            {v.sfUrl && <BrandLink kind="sf" href={v.sfUrl} label="Perfil no Salesforce" />}
            {v.eoxUrl && <BrandLink kind="eox" href={v.eoxUrl} />}
          </div>
        )}

        {!editing && v.canManage && !v.canceled && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {next && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => setVisitStatusAction(v.leadId, v.id, next), undefined, onClose)}><CheckCircle2 size={16} aria-hidden /> {next === "confirmada" ? "Confirmar visita" : "Marcar como realizada"}</button>}
            {v.status !== "pendente" && <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => setVisitStatusAction(v.leadId, v.id, "pendente"), undefined, onClose)}>Voltar para aguardando</button>}
            <button type="button" className={btnGhost} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden /> Editar visita</button>
          </div>
        )}
        <Link href={`/leads/${v.leadId}`} className={`${editing ? btnGhost : btnPrimary} w-full`}>Ir para o perfil do cliente</Link>
      </div>
    </div>
  );
}
