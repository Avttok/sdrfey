"use client";

import { EoxIcon, SalesforceIcon } from "@/components/brand-icons";
import { Building2, History, Plus, Package, Trash2, Tags, CalendarClock, Check, ExternalLink, FileText, Link2, Mail, MessageCircle, NotebookPen, Phone, PhoneCall, RotateCcw, Trophy, Undo2, UserPlus, XCircle } from "lucide-react";
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
import { AndamentosTimeline } from "./commercial-panels";
import type { CommEvent, CommVisit } from "@/modules/deals/lead-commercial";
import type { ClientHistory } from "@/modules/deals/history";
import { DealKpis, DealRecords, type DealPerson } from "./deal-extras";
import type { ScriptRunView } from "@/modules/scripts/runs-query";

type Ev = { id: number; kind: string; note: string | null; valueCents: number | null; at: string; by: string | null };
const STEPS = ["novo", "contato", "cotacao", "ganho"] as const;
type Kind = "ligacao" | "whatsapp" | "email";

const EV_ICON: Record<string, typeof Phone> = { ligacao: PhoneCall, whatsapp: MessageCircle, email: Mail, cotacao: FileText, nota: NotebookPen, ganho: Trophy, perdido: XCircle, retorno: CalendarClock, criado: UserPlus, assumido: UserPlus };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium text-muted">{label}</span>{children}{hint && <span className="text-[11px] text-muted">{hint}</span>}</div>;
}
const brl = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function DealPanel({ deal, events, quotes, tags, terms, extraPct, icmsPct = null, icmsRatePct = null, canDelete, phones, meId, team, canClaim, sellers, visits, clientEvents, history, runs, people }: { runs: ScriptRunView[]; people: DealPerson[]; clientEvents: CommEvent[]; history: ClientHistory | null; visits: CommVisit[]; deal: DealRow; events: Ev[]; quotes: QuoteView[]; tags: { group: string; label: string; color: string }[]; terms: string[]; extraPct: number; icmsPct?: number | null; icmsRatePct?: number | null; canDelete: boolean; phones: { value: string; label: string | null }[]; meId: number; team: boolean; canClaim: boolean; sellers: { id: number; name: string }[] }) {
  const { run, pending } = useRun();
  const closed = deal.stage === "ganho" || deal.stage === "perdido";
  const mine = deal.sellerId === meId || team;
  const [kinds, setKinds] = useState<Kind[]>(["ligacao"]);
  const [pick, setPick] = useState<number | null>(quotes.find((q) => !q.outcome)?.id ?? null);
  const [lostOpen, setLostOpen] = useState(false);
  const [newQuote, setNewQuote] = useState(false);
  const [termList, setTermList] = useState(terms);
  const [confirm, setConfirm] = useState<"reset" | "delete" | "return" | null>(null);
  const [returnWhy, setReturnWhy] = useState("");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [nextNote, setNextNote] = useState("");
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
  const pickQuote = quotes.find((q) => q.id === pick) ?? null;
  /** Só manda o que foi preenchido, para não apagar frete/condição que vêm da cotação. */
  const closeData = Object.fromEntries(Object.entries({ isReactivation: f.isReactivation, orderNumber: f.orderNumber, realValue: f.realValue, freight: f.freight, sapCode: f.sapCode, paymentTerms: f.paymentTerms, netValue: f.netValue }).filter(([, v]) => v !== "" ));
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

        <DealKpis deal={deal} quotes={quotes.length} runs={runs.length} events={clientEvents.length || events.length} visits={visits.length} />

        {!deal.sellerId && !closed && (
          <div className={`${panelCls} flex flex-wrap items-center justify-between gap-3 border-accent/50 p-4`}>
            <p className="text-sm">Esta negociação está no grupo dos vendedores. <b>Quem assumir primeiro fica com ela.</b></p>
            {canClaim && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => claimDealAction(deal.id))}><UserPlus size={16} aria-hidden /> Assumir e ligar</button>}
          </div>
        )}


        {closed && (
          <div className={`${panelCls} flex flex-wrap items-center justify-between gap-3 p-4 ${deal.stage === "ganho" ? "border-ok/50" : "border-danger/40"}`}>
            <p className="flex items-center gap-2 text-sm">{deal.stage === "ganho" ? <><Trophy size={18} className="text-ok" aria-hidden /> Faturado por <b>{fmtBRL(deal.mainCents)}</b>.</> : <><XCircle size={18} className="text-danger" aria-hidden /> Negócio perdido{deal.lostReason ? <>: <b>{deal.lostReason}</b></> : ""}.</>}</p>
            {mine && <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => reopenDealAction(deal.id))}><RotateCcw size={15} aria-hidden /> Reabrir</button>}
          </div>
        )}

        {deal.stage !== "perdido" && (
          <ol aria-label="Etapas da negociação" className="flex items-center">
            {STEPS.map((s, i) => {
              const idx = STEPS.indexOf(deal.stage === "negociacao" ? "cotacao" : (deal.stage as (typeof STEPS)[number])), done = i < idx || deal.stage === "ganho", cur = i === idx;
              const clickable = mine && !!deal.sellerId && !closed && s !== "ganho";
              const color = STAGE_META[s].color;
              return (
                <li key={s} className="flex flex-1 items-center last:flex-none">
                  <button type="button" disabled={!clickable || pending} aria-current={cur ? "step" : undefined} onClick={() => run(() => setStageAction(deal.id, s as DealStage))} title={STAGE_META[s].hint}
                    className={`group flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold transition ${clickable ? "hover:bg-sunk" : "cursor-default"} ${cur || done ? "text-ink" : "text-muted"}`}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs transition" style={cur || done ? { background: color, borderColor: color, color: "var(--on-accent)" } : undefined}>{done && !cur ? <Check size={14} aria-hidden /> : i + 1}</span>
                    <span>{STAGE_META[s].label}</span>
                  </button>
                  {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-0.5 min-w-4 flex-1 rounded-full bg-line"><span className="block h-full rounded-full bg-accent transition-all" style={{ width: i < idx || deal.stage === "ganho" ? "100%" : "0%" }} /></span>}
                </li>
              );
            })}
          </ol>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-2">
        {mine && deal.sellerId && (
          <SectionCard icon={NotebookPen} title="Andamento" className="flex flex-col">
            {!closed && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kinds: kinds.length ? kinds : ["nota"], note, nextAt: nextAt || null, nextNote: nextNote || null }), undefined, reset); }}>
                <div className="flex flex-wrap items-center gap-2">
                  {([["ligacao", "Ligação", PhoneCall], ["whatsapp", "WhatsApp", MessageCircle], ["email", "E-mail", Mail]] as const).map(([k, l, I]) => (
                    <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => setKinds((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${kinds.includes(k) ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
                  ))}
                </div>
                <textarea className={`${inputCls} min-h-24`} placeholder={kinds.length ? "O que foi conversado?" : "Escreva uma anotação"} aria-label="Anotação" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-48 text-sm"><span className="mb-1 block text-muted">Voltar a falar em</span><DateInput label="Próximo contato" value={nextAt} onChange={setNextAt} /></div>
                  <label className="block min-w-48 flex-1 text-sm"><span className="mb-1 block text-muted">Combinado</span><input className={inputCls} placeholder="Ex.: ligar para fechar" value={nextNote} onChange={(e) => setNextNote(e.target.value)} /></label>
                  <button className={`${btnPrimary} whitespace-nowrap`} disabled={pending || (!kinds.length && !note.trim())}><Check size={16} aria-hidden /> {kinds.length ? "Registrar contato" : "Salvar anotação"}</button>
                </div>
              </form>
            )}
            <div className={closed ? "" : "mt-4 border-t border-line/70 pt-4"}><AndamentosTimeline events={clientEvents.length ? clientEvents : events.map((e) => ({ ...e, dealId: deal.id }))} showDeal maxH="max-h-[26rem]" /></div>
          </SectionCard>
        )}

        {(mine && deal.sellerId) && (
          <SectionCard icon={Package} title="Fechamento" className="flex flex-col">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">{closed ? "Cotação" : "Cotação a faturar"}</p>
                {quotes.length === 0 ? <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">Sem cotações. Registre uma abaixo ou informe o valor direto.</p> : (
                  <div role="radiogroup" aria-label="Cotação a faturar" className="grid gap-2">
                    {quotes.map((q) => {
                      const on = pick === q.id;
                      return (
                        <button key={q.id} type="button" role="radio" aria-checked={on} disabled={closed} onClick={() => { setPick(on ? null : q.id); }} className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left text-sm transition ${on ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"} disabled:cursor-default`}>
                          <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{on && <Check size={12} aria-hidden />}</span>
                          <span className="min-w-0 flex-1"><b>{q.number ?? `Cotação #${q.id}`}</b><span className="block text-xs text-muted">{q.quoteDate ? q.quoteDate.split("-").reverse().join("/") : "sem data"}{q.paymentTerms ? ` · ${q.paymentTerms}` : ""}</span></span>
                          <span className="figure text-right font-semibold">{fmtBRL(q.totalCents)}</span>
                          {q.outcome && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${q.outcome === "faturado" ? "bg-ok/15 text-ok" : "bg-danger/12 text-danger"}`}>{q.outcome === "faturado" ? "Faturada" : "Perdida"}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <form id="deal-data" className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveDealDataAction(deal.id, f)); }}>
                <Field label="Valor faturado (R$)"><input className={inputCls} inputMode="decimal" placeholder={pickQuote?.totalCents ? brl(pickQuote.totalCents) : "0,00"} value={f.closedValue} onChange={(e) => set("closedValue", e.target.value)} /></Field>
                <Field label="Valor real (R$)"><input className={inputCls} inputMode="decimal" placeholder="Opcional" value={f.realValue} onChange={(e) => set("realValue", e.target.value)} /></Field>
                <Field label="Nº do pedido"><input className={inputCls} value={f.orderNumber} onChange={(e) => set("orderNumber", e.target.value)} /></Field>
                <Field label="Data do faturamento"><DateInput label="Data do faturamento" value={f.closedOn} onChange={(v) => set("closedOn", v)} /></Field>
                <Field label="Frete"><select className={inputCls} value={f.freight} onChange={(e) => set("freight", e.target.value)}><option value="">—</option><option>CIF</option><option>FOB</option><option>RED</option></select></Field>
                <Field label="Condição de pagamento"><select className={inputCls} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}><option value="">—</option>{[...new Set([...(f.paymentTerms ? [f.paymentTerms] : []), ...termList])].map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Código SAP"><input className={inputCls} value={f.sapCode} onChange={(e) => set("sapCode", e.target.value)} /></Field>
                <Field label="Valor sem impostos (R$)"><input className={inputCls} inputMode="decimal" value={f.netValue} onChange={(e) => set("netValue", e.target.value)} /></Field>
                <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={f.isReactivation} onChange={(e) => set("isReactivation", e.target.checked)} /> Cliente reativado</label>
              </form>

              {lostOpen && !closed && (
                <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <textarea className={`${inputCls} min-h-20`} aria-label="Motivo da perda" placeholder="O que aconteceu?" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex flex-wrap gap-1.5">{["Preço", "Fechou com concorrente", "Sem interesse", "Sem resposta", "Prazo de entrega"].map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent">{r}</button>)}</div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
                <button type="submit" form="deal-data" className={btnGhost} disabled={pending}><Check size={16} aria-hidden /> Salvar dados</button>
                {!closed && (
                  <>
                    <button type="button" className={`${btnPrimary} ml-auto`} disabled={pending} onClick={() => run(() => closeDealAction(deal.id, { won: true, quoteId: pick, value: f.closedValue || (pickQuote?.totalCents ? brl(pickQuote.totalCents) : ""), closedOn: f.closedOn || null, data: closeData }))}><Trophy size={16} aria-hidden /> Faturar{pickQuote ? ` ${pickQuote.number ?? "cotação"}` : ""}</button>
                    {lostOpen
                      ? <button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={pending || !reason.trim()} onClick={() => setConfirmLost(true)}><XCircle size={16} aria-hidden /> Confirmar perda</button>
                      : <button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={pending} onClick={() => setLostOpen(true)}><XCircle size={16} aria-hidden /> Perdida</button>}
                  </>
                )}
              </div>
            </div>
          </SectionCard>
        )}
        </div>

        {mine && deal.sellerId && (
          <SectionCard icon={FileText} title={`Cotações${quotes.length ? ` (${quotes.length})` : ""}`}>
            <div className="space-y-3">
              {quotes.map((q, n) => <QuoteCard key={q.id} dealId={deal.id} q={q} terms={termList} extraPct={extraPct} icmsPct={icmsPct} icmsRatePct={icmsRatePct} onTerm={addTerm} leadCnpj={deal.cnpj ?? ""} editable={!closed} isLast={n === 0} />)}
              {quotes.length === 0 && !newQuote && <p className="text-sm text-muted">Nenhuma cotação enviada ainda.</p>}
              {newQuote
                ? <QuoteEditor dealId={deal.id} extraPct={extraPct} icmsPct={icmsPct} icmsRatePct={icmsRatePct} terms={termList} onTerm={addTerm} leadCnpj={deal.cnpj ?? ""} onClose={() => setNewQuote(false)} />
                : !closed && <button type="button" className={btnPrimary} onClick={() => setNewQuote(true)}><Plus size={16} aria-hidden /> {quotes.length ? "Nova cotação" : "Registrar cotação"}</button>}
            </div>
          </SectionCard>
        )}

        {mine && !closed && deal.sdrId && (team || ((deal.stage === "novo" || deal.stage === "contato") && quotes.length === 0)) && (
          <SectionCard icon={Undo2} title="Repassado por engano?">
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
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={`${btnGhost} w-full`} disabled={pending} onClick={() => setConfirm("reset")}><RotateCcw size={15} aria-hidden /> Resetar negociação</button>
              <button type="button" className={`${btnGhost} w-full !border-danger text-danger`} disabled={pending} onClick={() => setConfirm("delete")}><Trash2 size={15} aria-hidden /> Apagar negociação</button>
            </div>
          </SectionCard>
        )}
      </div>

      <DealRecords deal={deal} runs={runs} history={history} visits={visits} people={people} />

      <ConfirmDialog open={confirm !== null} tone="danger" icon={confirm === "return" ? Undo2 : Trash2} title={confirm === "delete" ? "Apagar esta negociação?" : confirm === "return" ? "Devolver ao SDR?" : "Resetar esta negociação?"} confirmLabel={confirm === "delete" ? "Sim, apagar" : confirm === "return" ? "Sim, devolver" : "Sim, resetar"} busy={pending} onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); if (c === "delete") run(() => deleteDealAction(deal.id), undefined, () => router.push("/negociacoes")); else if (c === "return") run(() => returnDealToSdrAction(deal.id, returnWhy), undefined, () => router.push("/negociacoes"), "Devolvendo…"); else run(() => resetDealAction(deal.id)); }}>
        {confirm === "delete" ? "A negociação, as cotações e o histórico serão apagados. Um registro completo fica guardado na auditoria do admin." : confirm === "return" ? (
          <span className="block space-y-3"><span className="block">A negociação com {deal.company} sai da lista dos vendedores e o lead volta para {deal.sdrName ?? "o SDR"}. O registro fica na auditoria.</span>
            <input className={inputCls} placeholder="Motivo (opcional)" maxLength={300} value={returnWhy} onChange={(e) => setReturnWhy(e.target.value)} aria-label="Motivo da devolução" /></span>
        ) : "As cotações e o histórico serão apagados e a negociação volta ao início. Um registro completo fica na auditoria do admin."}
      </ConfirmDialog>
      <ConfirmDialog open={confirmLost} tone="danger" icon={XCircle} title="Marcar como perdida?" confirmLabel="Sim, perdida" busy={pending} onCancel={() => setConfirmLost(false)} onConfirm={() => { setConfirmLost(false); run(() => closeDealAction(deal.id, { won: false, reason }), undefined, () => setLostOpen(false)); }}>
        A negociação com {deal.company} será encerrada. Você pode reabri-la depois.
      </ConfirmDialog>
    </div>
  );
}
