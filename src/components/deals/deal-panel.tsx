"use client";

import { Building2, CalendarClock, Check, ExternalLink, FileText, Link2, Mail, MessageCircle, NotebookPen, Phone, PhoneCall, RotateCcw, Trophy, UserPlus, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DateInput } from "@/components/date-input";
import { SectionCard } from "@/components/section-card";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { DEAL_EVENT_LABEL, fmtBRL, OPEN_STAGES, STAGE_META } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import { fmtDateTime, fmtPhone } from "@/lib/format";
import { claimDealAction, closeDealAction, logContactAction, reassignDealAction, reopenDealAction, saveLeadLinksAction, sendQuoteAction, setStageAction } from "@/modules/deals/actions";
import type { DealRow } from "@/modules/deals/queries";
import { AlertChip, StageChip } from "./deal-ui";

type Ev = { id: number; kind: string; note: string | null; valueCents: number | null; at: string; by: string | null };
type Tab = "contato" | "cotacao" | "nota" | "encerrar";

const EV_ICON: Record<string, typeof Phone> = { ligacao: PhoneCall, whatsapp: MessageCircle, email: Mail, cotacao: FileText, nota: NotebookPen, ganho: Trophy, perdido: XCircle, retorno: CalendarClock, criado: UserPlus, assumido: UserPlus };

export function DealPanel({ deal, events, phones, meId, team, canClaim, sellers }: { deal: DealRow; events: Ev[]; phones: { value: string; label: string | null }[]; meId: number; team: boolean; canClaim: boolean; sellers: { id: number; name: string }[] }) {
  const { run, pending } = useRun();
  const closed = deal.stage === "ganho" || deal.stage === "perdido";
  const mine = deal.sellerId === meId || team;
  const [tab, setTab] = useState<Tab>("contato");
  const [kind, setKind] = useState<"ligacao" | "whatsapp" | "email">("ligacao");
  const [note, setNote] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [nextNote, setNextNote] = useState("");
  const [value, setValue] = useState(deal.valueCents ? (deal.valueCents / 100).toFixed(2).replace(".", ",") : "");
  const [days, setDays] = useState(2);
  const [reason, setReason] = useState("");
  const [confirmLost, setConfirmLost] = useState(false);
  const [sf, setSf] = useState(deal.salesforceUrl ?? "");
  const [eox, setEox] = useState(deal.eoxUrl ?? "");
  const [editLinks, setEditLinks] = useState(false);
  const wa = (d: string) => `https://wa.me/${d.length <= 11 ? "55" : ""}${d}`;
  const list = phones.length ? phones.map((p) => p.value) : deal.phone ? [deal.phone] : [];
  const reset = () => { setNote(""); setNextAt(""); setNextNote(""); setReason(""); };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <section className={`${panelCls} space-y-4 p-5`}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent"><Building2 size={22} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h1 className="display break-words text-2xl leading-tight">{deal.company}</h1>
              <p className="text-sm text-muted">{[deal.city && `${deal.city}/${deal.uf}`, deal.contactName].filter(Boolean).join(" · ") || "Sem dados de contato"}</p>
            </div>
            <StageChip stage={deal.stage} />
          </div>
          {deal.alerts.length > 0 && <div className="flex flex-wrap gap-2">{deal.alerts.map((a) => <AlertChip key={a.kind} a={a} />)}</div>}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Telefones</p>
              {list.length === 0 && <p className="text-muted">Nenhum telefone.</p>}
              {list.map((p) => (
                <p key={p} className="flex flex-wrap items-center gap-2">
                  <a href={`tel:+55${p}`} className="figure font-medium hover:text-accent">{fmtPhone(p)}</a>
                  <a href={wa(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok hover:brightness-110"><MessageCircle size={12} aria-hidden /> WhatsApp</a>
                </p>
              ))}
              {deal.email && <p className="flex items-center gap-2 pt-1"><Mail size={14} className="text-muted" aria-hidden /><a href={`mailto:${deal.email}`} className="truncate hover:text-accent">{deal.email}</a></p>}
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center justify-between text-xs font-medium text-muted">Perfis do cliente <button type="button" className="font-medium text-accent hover:underline" onClick={() => setEditLinks(!editLinks)}>{editLinks ? "Fechar" : "Editar links"}</button></p>
              {!editLinks && <div className="flex flex-wrap gap-2">
                {deal.salesforceUrl ? <a href={deal.salesforceUrl} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink size={14} aria-hidden /> Salesforce</a> : <span className="text-muted">Sem link do Salesforce</span>}
                {deal.eoxUrl ? <a href={deal.eoxUrl} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink size={14} aria-hidden /> CRM (EOX)</a> : <span className="text-muted">Sem link do EOX</span>}
              </div>}
              {editLinks && (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => saveLeadLinksAction(deal.leadId, { salesforceUrl: sf, eoxUrl: eox }), undefined, () => setEditLinks(false)); }}>
                  <input className={inputCls} placeholder="Link do perfil no Salesforce" value={sf} onChange={(e) => setSf(e.target.value)} aria-label="Link do Salesforce" />
                  <input className={inputCls} placeholder="Link do perfil no CRM (EOX)" value={eox} onChange={(e) => setEox(e.target.value)} aria-label="Link do CRM EOX" />
                  <button className={btnPrimary} disabled={pending}><Check size={16} aria-hidden /> Salvar links</button>
                </form>
              )}
            </div>
          </div>
          {deal.handoffNote && <p className="rounded-lg bg-sunk px-3 py-2 text-sm"><span className="text-xs font-medium text-muted">Recado do SDR{deal.sdrName ? ` (${deal.sdrName})` : ""}</span><br />{deal.handoffNote}</p>}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <Link href={`/leads/${deal.leadId}`} className="inline-flex items-center gap-1 hover:text-accent"><Link2 size={12} aria-hidden /> Ver lead completo</Link>
            <span>Vendedor: <b className="text-ink">{deal.sellerName ?? "ninguém ainda"}</b></span>
            {deal.valueCents ? <span>Valor: <b className="figure text-ink">{fmtBRL(deal.valueCents)}</b></span> : null}
            {deal.nextActionAt && !closed ? <span>Próximo passo: <b className="text-ink">{fmtDateTime(deal.nextActionAt).slice(0, 10)}{deal.nextActionNote ? ` · ${deal.nextActionNote}` : ""}</b></span> : null}
          </p>
        </section>

        {!deal.sellerId && !closed && (
          <div className={`${panelCls} flex flex-wrap items-center justify-between gap-3 border-accent/50 p-4`}>
            <p className="text-sm">Esta negociação está no grupo dos vendedores. <b>Quem assumir primeiro fica com ela.</b></p>
            {canClaim && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => claimDealAction(deal.id))}><UserPlus size={16} aria-hidden /> Assumir e ligar</button>}
          </div>
        )}

        {mine && deal.sellerId && !closed && (
          <>
            <div role="radiogroup" aria-label="Etapa" className="flex flex-wrap gap-2">
              {OPEN_STAGES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={deal.stage === s} disabled={pending} onClick={() => run(() => setStageAction(deal.id, s as DealStage))} title={STAGE_META[s].hint}
                  className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition ${deal.stage === s ? "text-on-accent" : "border-line hover:bg-sunk"}`} style={deal.stage === s ? { background: STAGE_META[s].color, borderColor: STAGE_META[s].color } : undefined}>{STAGE_META[s].label}</button>
              ))}
            </div>
            <SectionCard icon={NotebookPen} title="Registrar andamento">
              <div role="tablist" className="flex flex-wrap gap-2">
                {([["contato", "Contato feito", PhoneCall], ["cotacao", "Enviei cotação", FileText], ["nota", "Anotação", NotebookPen], ["encerrar", "Encerrar", Trophy]] as const).map(([k, l, I]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${tab === k ? "border-transparent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
                ))}
              </div>
              {tab === "contato" && (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kind, note, nextAt: nextAt || null, nextNote: nextNote || null }), undefined, reset); }}>
                  <div className="flex flex-wrap gap-2">
                    {([["ligacao", "Ligação", PhoneCall], ["whatsapp", "WhatsApp", MessageCircle], ["email", "E-mail", Mail]] as const).map(([k, l, I]) => (
                      <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${kind === k ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
                    ))}
                  </div>
                  <textarea className={`${inputCls} min-h-20`} placeholder="O que foi conversado?" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-48 text-sm"><span className="mb-1 block text-muted">Voltar a falar em</span><DateInput label="Próximo contato" value={nextAt} onChange={setNextAt} /></div>
                    <label className="block min-w-48 flex-1 text-sm"><span className="mb-1 block text-muted">Combinado</span><input className={inputCls} placeholder="Ex.: ligar para fechar" value={nextNote} onChange={(e) => setNextNote(e.target.value)} /></label>
                    <button className={btnPrimary} disabled={pending}><Check size={16} aria-hidden /> Registrar contato</button>
                  </div>
                </form>
              )}
              {tab === "cotacao" && (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => sendQuoteAction(deal.id, { value, note, followupDays: days }), undefined, reset); }}>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block w-48 text-sm"><span className="mb-1 block text-muted">Valor da cotação (R$)</span><input className={inputCls} inputMode="decimal" placeholder="12.500,00" value={value} onChange={(e) => setValue(e.target.value)} /></label>
                    <label className="block w-48 text-sm"><span className="mb-1 block text-muted">Cobrar em (dias)</span><input className={inputCls} type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
                  </div>
                  <textarea className={`${inputCls} min-h-20`} placeholder="Produtos, condições, prazo… (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className={btnPrimary} disabled={pending}><FileText size={16} aria-hidden /> Registrar cotação e agendar cobrança</button>
                </form>
              )}
              {tab === "nota" && (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kind: "nota", note, nextAt: null, nextNote: null }), undefined, reset); }}>
                  <textarea className={`${inputCls} min-h-24`} placeholder="Anotação (não conta como contato)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className={btnPrimary} disabled={pending}><Check size={16} aria-hidden /> Salvar anotação</button>
                </form>
              )}
              {tab === "encerrar" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-ok/40 p-4">
                    <p className="flex items-center gap-2 font-semibold text-ok"><Trophy size={16} aria-hidden /> Venda fechada</p>
                    <input className={inputCls} inputMode="decimal" placeholder="Valor final (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
                    <button type="button" className={`${btnPrimary} w-full`} disabled={pending} onClick={() => run(() => closeDealAction(deal.id, { won: true, value }))}>Fechar venda</button>
                  </div>
                  <div className="space-y-2 rounded-xl border border-danger/40 p-4">
                    <p className="flex items-center gap-2 font-semibold text-danger"><XCircle size={16} aria-hidden /> Negócio perdido</p>
                    <input className={inputCls} placeholder="Motivo (preço, concorrente, sem interesse…)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <button type="button" className={`${btnGhost} w-full !border-danger text-danger`} disabled={pending || !reason.trim()} onClick={() => setConfirmLost(true)}>Marcar como perdida</button>
                  </div>
                </div>
              )}
            </SectionCard>
          </>
        )}

        {closed && (
          <div className={`${panelCls} flex flex-wrap items-center justify-between gap-3 p-4 ${deal.stage === "ganho" ? "border-ok/50" : "border-danger/40"}`}>
            <p className="text-sm">{deal.stage === "ganho" ? <>Venda fechada por <b>{fmtBRL(deal.valueCents)}</b>.</> : <>Negócio perdido{deal.lostReason ? <>: <b>{deal.lostReason}</b></> : ""}.</>}</p>
            {mine && <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => reopenDealAction(deal.id))}><RotateCcw size={15} aria-hidden /> Reabrir</button>}
          </div>
        )}

        {team && !closed && (
          <div className={`${panelCls} flex flex-wrap items-center gap-3 p-4 text-sm`}>
            <span className="font-medium">Trocar vendedor</span>
            <select className={`${inputCls} !w-auto`} value={deal.sellerId ?? ""} disabled={pending} onChange={(e) => run(() => reassignDealAction(deal.id, e.target.value ? Number(e.target.value) : null))}>
              <option value="">Devolver ao grupo</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <aside className={`${panelCls} p-5`}>
        <h2 className="mb-4 text-[15px] font-semibold">Histórico da negociação</h2>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {events.map((e) => { const I = EV_ICON[e.kind] ?? NotebookPen; return (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[31px] grid size-6 place-items-center rounded-full border border-line bg-panel text-accent"><I size={12} aria-hidden /></span>
              <p className="font-medium">{DEAL_EVENT_LABEL[e.kind] ?? e.kind}{e.valueCents ? <span className="figure ml-1.5 text-muted">{fmtBRL(e.valueCents)}</span> : null}</p>
              {e.note && <p className="whitespace-pre-wrap text-muted">{e.note}</p>}
              <p className="text-xs text-muted">{fmtDateTime(e.at)}{e.by ? ` · ${e.by}` : ""}</p>
            </li>
          ); })}
        </ol>
      </aside>

      <ConfirmDialog open={confirmLost} tone="danger" icon={XCircle} title="Marcar como perdida?" confirmLabel="Sim, perdida" busy={pending} onCancel={() => setConfirmLost(false)} onConfirm={() => { setConfirmLost(false); run(() => closeDealAction(deal.id, { won: false, reason })); }}>
        A negociação com {deal.company} será encerrada. Você pode reabri-la depois.
      </ConfirmDialog>
    </div>
  );
}
