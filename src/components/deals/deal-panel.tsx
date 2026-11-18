"use client";

import { EoxIcon, SalesforceIcon } from "@/components/brand-icons";
import { Building2, Plus, Package, Trash2, Tags, CalendarClock, Check, ExternalLink, FileText, Link2, Mail, MessageCircle, NotebookPen, Phone, PhoneCall, RotateCcw, Trophy, Undo2, UserPlus, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DateInput } from "@/components/date-input";
import { TagChip } from "@/components/tag-chip";
import { SectionCard } from "@/components/section-card";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { DEAL_EVENT_LABEL, fmtBRL, OPEN_STAGES, STAGE_META } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import { chatproUrl, fmtDateTime, fmtPhone } from "@/lib/format";
import { claimDealAction, closeDealAction, logContactAction, reassignDealAction, reopenDealAction, saveDealDataAction, saveLeadLinksAction, deleteDealAction, resetDealAction, returnDealToSdrAction, setDealColorAction, setStageAction } from "@/modules/deals/actions";
import { QuoteCard, QuoteEditor, QuoteValues, type QuoteView } from "./quote-card";
import { useRouter } from "next/navigation";
import { ColorPicker } from "./color-picker";
import type { DealRow } from "@/modules/deals/queries";
import { AlertChip, StageChip } from "./deal-ui";
import { AndamentosPanel, VisitsPanel } from "./commercial-panels";
import type { CommVisit } from "@/modules/deals/lead-commercial";

type Ev = { id: number; kind: string; note: string | null; valueCents: number | null; at: string; by: string | null };
type Tab = "contato" | "nota" | "encerrar";
type Kind = "ligacao" | "whatsapp" | "email";

const EV_ICON: Record<string, typeof Phone> = { ligacao: PhoneCall, whatsapp: MessageCircle, email: Mail, cotacao: FileText, nota: NotebookPen, ganho: Trophy, perdido: XCircle, retorno: CalendarClock, criado: UserPlus, assumido: UserPlus };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium text-muted">{label}</span>{children}{hint && <span className="text-[11px] text-muted">{hint}</span>}</div>;
}
const brl = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function DealPanel({ deal, events, quotes, tags, terms, extraPct, canDelete, phones, meId, team, canClaim, sellers, visits }: { visits: CommVisit[]; deal: DealRow; events: Ev[]; quotes: QuoteView[]; tags: { group: string; label: string; color: string }[]; terms: string[]; extraPct: number; canDelete: boolean; phones: { value: string; label: string | null }[]; meId: number; team: boolean; canClaim: boolean; sellers: { id: number; name: string }[] }) {
  const { run, pending } = useRun();
  const closed = deal.stage === "ganho" || deal.stage === "perdido";
  const mine = deal.sellerId === meId || team;
  const [tab, setTab] = useState<Tab>("contato");
  const [kinds, setKinds] = useState<Kind[]>(["ligacao"]);
  const [newQuote, setNewQuote] = useState(false);
  const [termList, setTermList] = useState(terms);
  const [confirm, setConfirm] = useState<"reset" | "delete" | "return" | null>(null);
  const [returnWhy, setReturnWhy] = useState("");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [nextNote, setNextNote] = useState("");
  const [outcome, setOutcome] = useState<"ganho" | "perdido">("ganho");
  const [reason, setReason] = useState("");
  const [confirmLost, setConfirmLost] = useState(false);
  const [sf, setSf] = useState(deal.salesforceUrl ?? "");
  const [eox, setEox] = useState(deal.eoxUrl ?? "");
  const [editLinks, setEditLinks] = useState(false);
  const [f, setF] = useState({
    freight: deal.freight ?? "", sapCode: deal.sapCode ?? "", orderNumber: deal.orderNumber ?? "", quoteNumber: deal.quoteNumber ?? "", quoteDate: deal.quoteDate ?? "",
    closedOn: deal.closedOn ?? "", quoteValue: brl(deal.valueCents), netValue: brl(deal.netValueCents), closedValue: brl(deal.closedValueCents), realValue: brl(deal.realValueCents), paymentTerms: deal.paymentTerms ?? "", isReactivation: deal.isReactivation,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const addTerm = (t: string) => setTermList((p) => (p.includes(t) ? p : [...p, t]));
  const lastQuote = quotes[0];
  const list = phones.length ? phones.map((p) => p.value) : deal.phone ? [deal.phone] : [];
  const reset = () => { setNote(""); setNextAt(""); setNextNote(""); setReason(""); };

  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-4">
        <section className={`${panelCls} space-y-4 p-5`} style={deal.color ? { borderLeft: `6px solid ${deal.color}`, background: `color-mix(in srgb, ${deal.color} 7%, var(--panel))` } : undefined}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent"><Building2 size={22} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h1 className="display break-words text-xl leading-tight sm:text-[22px]">{deal.company}</h1>
              <p className="text-sm text-muted">{[deal.city && `${deal.city}/${deal.uf}`, deal.contactName].filter(Boolean).join(" · ") || "Sem dados de contato"}</p>
            </div>
            <StageChip stage={deal.stage} />
          </div>
          {mine && <ColorPicker value={deal.color} disabled={pending} onChange={(c) => run(() => setDealColorAction(deal.id, c), "Cor salva.")} />}
          {tags.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><Tags size={14} className="text-muted" aria-hidden />{tags.map((t) => <TagChip key={`${t.group}-${t.label}`} label={t.label} color={t.color} />)}</div>}
          {lastQuote && lastQuote.totalCents != null && <div className="rounded-xl bg-sunk/60 px-4 py-3"><p className="mb-1 text-[11px] font-medium text-muted">Cotação mais recente{lastQuote.number ? ` · ${lastQuote.number}` : ""}</p><QuoteValues q={lastQuote} /></div>}
          {deal.alerts.length > 0 && <div className="flex flex-wrap gap-2">{deal.alerts.map((a) => <AlertChip key={a.kind} a={a} />)}</div>}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Telefones</p>
              {list.length === 0 && <p className="text-muted">Nenhum telefone.</p>}
              {list.map((p) => (
                <p key={p} className="flex flex-wrap items-center gap-2">
                  <a href={`tel:+55${p}`} className="figure font-medium hover:text-accent">{fmtPhone(p)}</a>
                  <a href={chatproUrl(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok hover:brightness-110"><MessageCircle size={12} aria-hidden /> WhatsApp</a>
                </p>
              ))}
              {deal.email && <p className="flex items-center gap-2 pt-1"><Mail size={14} className="text-muted" aria-hidden /><a href={`mailto:${deal.email}`} className="truncate hover:text-accent">{deal.email}</a></p>}
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center justify-between text-xs font-medium text-muted">Perfis do cliente <button type="button" className="font-medium text-accent hover:underline" onClick={() => setEditLinks(!editLinks)}>{editLinks ? "Fechar" : "Editar links"}</button></p>
              {!editLinks && <div className="grid grid-cols-2 gap-2">
                {([["Salesforce", deal.salesforceUrl, "#0070d2", SalesforceIcon], ["CRM (EOX)", deal.eoxUrl, "#692E81", EoxIcon]] as const).map(([label, url, brand, Ico]) => url
                  ? <a key={label} href={url} target="_blank" rel="noreferrer" style={{ background: brand, borderColor: brand }} className={`${btnGhost} w-full !text-white hover:brightness-110`}><Ico size={15} /> {label}</a>
                  : <button key={label} type="button" onClick={() => setEditLinks(true)} className={`${btnGhost} w-full border-dashed !text-muted hover:!text-ink`}><Ico size={15} /> {label}</button>)}
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 pt-3 text-sm text-muted">
            <Link href={`/leads/${deal.leadId}`} className={`${btnGhost} !min-h-9 !px-3.5 !text-sm`}><Link2 size={15} aria-hidden /> Ver lead completo</Link>
            <span>Vendedor: <b className="text-ink">{deal.sellerName ?? "ninguém ainda"}</b></span>
            {deal.nextActionAt && !closed ? <span>Próximo passo: <b className="text-ink">{fmtDateTime(deal.nextActionAt).slice(0, 10)}{deal.nextActionNote ? ` · ${deal.nextActionNote}` : ""}</b></span> : null}
          </div>
        </section>

        {!deal.sellerId && !closed && (
          <div className={`${panelCls} flex flex-wrap items-center justify-between gap-3 border-accent/50 p-4`}>
            <p className="text-sm">Esta negociação está no grupo dos vendedores. <b>Quem assumir primeiro fica com ela.</b></p>
            {canClaim && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => claimDealAction(deal.id))}><UserPlus size={16} aria-hidden /> Assumir e ligar</button>}
          </div>
        )}

        {closed && (
          <div className={`${panelCls} flex flex-wrap items-center justify-between gap-3 p-4 ${deal.stage === "ganho" ? "border-ok/50" : "border-danger/40"}`}>
            <p className="text-sm">{deal.stage === "ganho" ? <>Venda fechada por <b>{fmtBRL(deal.mainCents)}</b>.</> : <>Negócio perdido{deal.lostReason ? <>: <b>{deal.lostReason}</b></> : ""}.</>}</p>
            {mine && <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => reopenDealAction(deal.id))}><RotateCcw size={15} aria-hidden /> Reabrir</button>}
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
          </>
        )}

        <div className="grid items-stretch gap-4 xl:grid-cols-2">
        {mine && deal.sellerId && !closed && (
          <>
            <SectionCard icon={NotebookPen} title="Registrar andamento" className="flex h-full flex-col">
              <div role="tablist" className="flex flex-wrap gap-2">
                {([["contato", "Contato feito", PhoneCall], ["nota", "Anotação", NotebookPen], ["encerrar", "Encerrar", Trophy]] as const).map(([k, l, I]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${tab === k ? "border-transparent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
                ))}
              </div>
              {tab === "contato" && (
                <form className="flex flex-1 flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kinds, note, nextAt: nextAt || null, nextNote: nextNote || null }), undefined, reset); }}>
                  <p className="text-xs text-muted">Marque todos os meios usados neste contato.</p>
                  <div className="flex flex-wrap gap-2">
                    {([["ligacao", "Ligação", PhoneCall], ["whatsapp", "WhatsApp", MessageCircle], ["email", "E-mail", Mail]] as const).map(([k, l, I]) => (
                      <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => setKinds((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]))} className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${kinds.includes(k) ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
                    ))}
                  </div>
                  <textarea className={`${inputCls} min-h-24 flex-1`} placeholder="O que foi conversado?" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-48 text-sm"><span className="mb-1 block text-muted">Voltar a falar em</span><DateInput label="Próximo contato" value={nextAt} onChange={setNextAt} /></div>
                    <label className="block min-w-48 flex-1 text-sm"><span className="mb-1 block text-muted">Combinado</span><input className={inputCls} placeholder="Ex.: ligar para fechar" value={nextNote} onChange={(e) => setNextNote(e.target.value)} /></label>
                    <button className={`${btnPrimary} whitespace-nowrap`} disabled={pending}><Check size={16} aria-hidden /> Registrar contato</button>
                  </div>
                </form>
              )}
              {tab === "nota" && (
                <form className="flex flex-1 flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kinds: ["nota"], note, nextAt: null, nextNote: null }), undefined, reset); }}>
                  <textarea className={`${inputCls} min-h-24 flex-1`} placeholder="Anotação (não conta como contato)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className={btnPrimary} disabled={pending}><Check size={16} aria-hidden /> Salvar anotação</button>
                </form>
              )}
              {tab === "encerrar" && (
                <div className="flex flex-1 flex-col gap-4">
                  <div role="radiogroup" aria-label="Resultado" className="grid grid-cols-2 gap-2 rounded-xl bg-sunk/60 p-1">
                    {([["ganho", "Venda fechada", Trophy, "text-ok"], ["perdido", "Negócio perdido", XCircle, "text-danger"]] as const).map(([k, l, I, c]) => (
                      <button key={k} type="button" role="radio" aria-checked={outcome === k} onClick={() => setOutcome(k)} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${outcome === k ? `bg-panel shadow-md ${c}` : "text-muted hover:text-ink"}`}><I size={16} aria-hidden />{l}</button>
                    ))}
                  </div>
                  {outcome === "ganho" ? (
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Valor fechado (R$)"><input className={inputCls} inputMode="decimal" placeholder={lastQuote?.totalCents ? brl(lastQuote.totalCents) : "0,00"} value={f.closedValue} onChange={(e) => set("closedValue", e.target.value)} /></Field>
                        <Field label="Valor real após impostos (R$)"><input className={inputCls} inputMode="decimal" placeholder="Opcional" value={f.realValue} onChange={(e) => set("realValue", e.target.value)} /></Field>
                        <Field label="Data fechada"><DateInput label="Data fechada" value={f.closedOn} onChange={(v) => set("closedOn", v)} /></Field>
                        <Field label="Cliente"><button type="button" role="switch" aria-checked={f.isReactivation} onClick={() => set("isReactivation", !f.isReactivation)} className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${f.isReactivation ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}><span className={`relative h-5 w-9 shrink-0 rounded-full transition ${f.isReactivation ? "bg-accent" : "bg-line"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${f.isReactivation ? "left-[18px]" : "left-0.5"}`} /></span>Reativado (voltou a comprar)</button></Field>
                      </div>
                      <p className="text-xs text-muted">Em branco, o valor fechado é o total da última cotação.</p>
                      <div className="mt-auto">
                        <button type="button" className={`${btnPrimary} w-full`} disabled={pending} onClick={() => run(() => closeDealAction(deal.id, { won: true, value: f.closedValue || (lastQuote?.totalCents ? brl(lastQuote.totalCents) : ""), closedOn: f.closedOn || null, data: { isReactivation: f.isReactivation, orderNumber: f.orderNumber, realValue: f.realValue } }))}><Trophy size={16} aria-hidden /> Fechar venda</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col gap-3">
                      <Field label="Motivo da perda">
                        <textarea className={`${inputCls} min-h-24`} placeholder="O que aconteceu? (preço, concorrente, sem interesse…)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      </Field>
                      <div className="flex flex-wrap gap-1.5">
                        {["Preço", "Fechou com concorrente", "Sem interesse", "Sem resposta", "Prazo de entrega"].map((r) => (
                          <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent">{r}</button>
                        ))}
                      </div>
                      <div className="mt-auto">
                        <button type="button" className={`${btnGhost} w-full !border-danger text-danger`} disabled={pending || !reason.trim()} onClick={() => setConfirmLost(true)}><XCircle size={16} aria-hidden /> Marcar como perdida</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </>
        )}



        {(mine && deal.sellerId) && (
          <SectionCard icon={Package} title="Dados da negociação" className="flex h-full flex-col">
            <form className="grid flex-1 content-start gap-x-4 gap-y-3 text-sm sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveDealDataAction(deal.id, f)); }}>
              <Field label="Frete"><select className={inputCls} value={f.freight} onChange={(e) => set("freight", e.target.value)}><option value="">—</option><option>CIF</option><option>FOB</option><option>RED</option></select></Field>
              <Field label="Código SAP"><input className={inputCls} value={f.sapCode} onChange={(e) => set("sapCode", e.target.value)} /></Field>
              <Field label="Condição de pagamento"><select className={inputCls} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}><option value="">—</option>{[...new Set([...(f.paymentTerms ? [f.paymentTerms] : []), ...termList])].map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Nº da cotação"><input className={`${inputCls} opacity-70`} readOnly value={f.quoteNumber} /></Field>
              <Field label="Data da cotação"><input className={`${inputCls} opacity-70`} readOnly value={f.quoteDate ? f.quoteDate.split("-").reverse().join("/") : ""} /></Field>
              <Field label="Valor sem impostos (R$)" hint="Pode corrigir com o do Salesforce."><input className={inputCls} inputMode="decimal" value={f.netValue} onChange={(e) => set("netValue", e.target.value)} /></Field>
              <Field label="Total com impostos (R$)"><input className={`${inputCls} opacity-70`} readOnly value={f.quoteValue} /></Field>
              <Field label="Nº do pedido"><input className={inputCls} value={f.orderNumber} onChange={(e) => set("orderNumber", e.target.value)} /></Field>
              <Field label="Data fechada"><DateInput label="Data fechada" value={f.closedOn} onChange={(v) => set("closedOn", v)} /></Field>
              <Field label="Valor fechado (R$)"><input className={inputCls} inputMode="decimal" value={f.closedValue} onChange={(e) => set("closedValue", e.target.value)} /></Field>
              <Field label="Valor real (R$)" hint="Opcional; senão conta o sem impostos."><input className={inputCls} inputMode="decimal" value={f.realValue} onChange={(e) => set("realValue", e.target.value)} /></Field>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3 sm:col-span-2">
                <label className="flex items-center gap-2"><input type="checkbox" checked={f.isReactivation} onChange={(e) => set("isReactivation", e.target.checked)} /> Cliente reativado</label>
                <button className={`${btnPrimary} whitespace-nowrap`} disabled={pending}><Check size={16} aria-hidden /> Salvar dados</button>
              </div>
            </form>
          </SectionCard>
        )}
        </div>

        {mine && deal.sellerId && (
          <SectionCard icon={FileText} title={`Cotações${quotes.length ? ` (${quotes.length})` : ""}`}>
            <div className="space-y-3">
              {quotes.map((q, n) => <QuoteCard key={q.id} dealId={deal.id} q={q} terms={termList} extraPct={extraPct} onTerm={addTerm} leadCnpj={deal.cnpj ?? ""} editable={!closed} isLast={n === 0} />)}
              {quotes.length === 0 && !newQuote && <p className="text-sm text-muted">Nenhuma cotação enviada ainda.</p>}
              {newQuote
                ? <QuoteEditor dealId={deal.id} extraPct={extraPct} terms={termList} onTerm={addTerm} leadCnpj={deal.cnpj ?? ""} onClose={() => setNewQuote(false)} />
                : !closed && <button type="button" className={btnPrimary} onClick={() => setNewQuote(true)}><Plus size={16} aria-hidden /> {quotes.length ? "Nova cotação" : "Registrar cotação"}</button>}
            </div>
          </SectionCard>
        )}

        {mine && !closed && deal.sdrId && (team || ((deal.stage === "novo" || deal.stage === "contato") && quotes.length === 0)) && (
          <SectionCard icon={Undo2} title="Repassado por engano?">
            <p className="text-sm text-muted">Devolve o lead para {deal.sdrName ?? "o SDR"}: a negociação some daqui, a visita ainda não realizada é cancelada e o lead volta ao Shuffler dele para ser atendido de novo.</p>
            <button type="button" className={`${btnGhost} w-full`} disabled={pending} onClick={() => { setReturnWhy(""); setConfirm("return"); }}><Undo2 size={15} aria-hidden /> Devolver ao SDR</button>
          </SectionCard>
        )}
        {team && !closed && (
          <SectionCard icon={UserPlus} title="Vendedor responsável">
            <select aria-label="Trocar vendedor" className={inputCls} value={deal.sellerId ?? ""} disabled={pending} onChange={(e) => run(() => reassignDealAction(deal.id, e.target.value ? Number(e.target.value) : null))}>
              <option value="">Devolver ao grupo</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </SectionCard>
        )}
        {canDelete && (
          <SectionCard icon={Trash2} title="Gestão da negociação">
            <p className="text-sm text-muted">Resetar volta ao início (apaga cotações e histórico). Apagar remove tudo. Nos dois casos fica um registro completo na auditoria do admin.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={`${btnGhost} w-full`} disabled={pending} onClick={() => setConfirm("reset")}><RotateCcw size={15} aria-hidden /> Resetar negociação</button>
              <button type="button" className={`${btnGhost} w-full !border-danger text-danger`} disabled={pending} onClick={() => setConfirm("delete")}><Trash2 size={15} aria-hidden /> Apagar negociação</button>
            </div>
          </SectionCard>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AndamentosPanel events={events.map((e) => ({ ...e, dealId: deal.id }))} title="Andamentos registrados" />
        <VisitsPanel visits={visits} />
      </div>

      <ConfirmDialog open={confirm !== null} tone="danger" icon={confirm === "return" ? Undo2 : Trash2} title={confirm === "delete" ? "Apagar esta negociação?" : confirm === "return" ? "Devolver ao SDR?" : "Resetar esta negociação?"} confirmLabel={confirm === "delete" ? "Sim, apagar" : confirm === "return" ? "Sim, devolver" : "Sim, resetar"} busy={pending} onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); if (c === "delete") run(() => deleteDealAction(deal.id), undefined, () => router.push("/negociacoes")); else if (c === "return") run(() => returnDealToSdrAction(deal.id, returnWhy), undefined, () => router.push("/negociacoes"), "Devolvendo…"); else run(() => resetDealAction(deal.id)); }}>
        {confirm === "delete" ? "A negociação, as cotações e o histórico serão apagados. Um registro completo fica guardado na auditoria do admin." : confirm === "return" ? (
          <span className="block space-y-3"><span className="block">A negociação com {deal.company} sai da lista dos vendedores e o lead volta para {deal.sdrName ?? "o SDR"}. O registro fica na auditoria.</span>
            <input className={inputCls} placeholder="Motivo (opcional)" maxLength={300} value={returnWhy} onChange={(e) => setReturnWhy(e.target.value)} aria-label="Motivo da devolução" /></span>
        ) : "As cotações e o histórico serão apagados e a negociação volta ao início. Um registro completo fica na auditoria do admin."}
      </ConfirmDialog>
      <ConfirmDialog open={confirmLost} tone="danger" icon={XCircle} title="Marcar como perdida?" confirmLabel="Sim, perdida" busy={pending} onCancel={() => setConfirmLost(false)} onConfirm={() => { setConfirmLost(false); run(() => closeDealAction(deal.id, { won: false, reason })); }}>
        A negociação com {deal.company} será encerrada. Você pode reabri-la depois.
      </ConfirmDialog>
    </div>
  );
}
