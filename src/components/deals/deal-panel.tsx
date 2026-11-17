"use client";

import { Building2, MapPin, Plus, Package, Trash2, Tags, CalendarClock, Check, ExternalLink, FileText, Link2, Mail, MessageCircle, NotebookPen, Phone, PhoneCall, RotateCcw, Trophy, UserPlus, XCircle } from "lucide-react";
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
import { claimDealAction, closeDealAction, logContactAction, reassignDealAction, reopenDealAction, saveDealDataAction, saveLeadLinksAction, deleteDealAction, resetDealAction, setDealColorAction, setStageAction } from "@/modules/deals/actions";
import { QuoteCard, QuoteEditor, QuoteValues, type QuoteView } from "./quote-card";
import { useRouter } from "next/navigation";
import { ColorPicker } from "./color-picker";
import type { DealRow } from "@/modules/deals/queries";
import { AlertChip, StageChip } from "./deal-ui";

type Ev = { id: number; kind: string; note: string | null; valueCents: number | null; at: string; by: string | null };
type Tab = "contato" | "nota" | "encerrar";
type Kind = "ligacao" | "whatsapp" | "email";

const EV_ICON: Record<string, typeof Phone> = { ligacao: PhoneCall, whatsapp: MessageCircle, email: Mail, cotacao: FileText, nota: NotebookPen, ganho: Trophy, perdido: XCircle, retorno: CalendarClock, criado: UserPlus, assumido: UserPlus };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium text-muted">{label}</span>{children}{hint && <span className="text-[11px] text-muted">{hint}</span>}</div>;
}
const brl = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function DealPanel({ deal, events, quotes, tags, terms, canDelete, phones, meId, team, canClaim, sellers }: { deal: DealRow; events: Ev[]; quotes: QuoteView[]; tags: { group: string; label: string; color: string }[]; terms: string[]; canDelete: boolean; phones: { value: string; label: string | null }[]; meId: number; team: boolean; canClaim: boolean; sellers: { id: number; name: string }[] }) {
  const { run, pending } = useRun();
  const closed = deal.stage === "ganho" || deal.stage === "perdido";
  const mine = deal.sellerId === meId || team;
  const [tab, setTab] = useState<Tab>("contato");
  const [kinds, setKinds] = useState<Kind[]>(["ligacao"]);
  const [newQuote, setNewQuote] = useState(false);
  const [termList, setTermList] = useState(terms);
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
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
    closedOn: deal.closedOn ?? "", quoteValue: brl(deal.valueCents), closedValue: brl(deal.closedValueCents), realValue: brl(deal.realValueCents), paymentTerms: deal.paymentTerms ?? "", isReactivation: deal.isReactivation,
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
              {deal.addressLine && <p className="flex items-start gap-2 pt-1 text-muted"><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden /><span>{deal.addressLine}{deal.city ? ` · ${deal.city}/${deal.uf}` : ""}</span></p>}
              {deal.stateReg && <p className="pl-6 text-xs text-muted">Inscrição estadual {deal.stateReg}</p>}
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center justify-between text-xs font-medium text-muted">Perfis do cliente <button type="button" className="font-medium text-accent hover:underline" onClick={() => setEditLinks(!editLinks)}>{editLinks ? "Fechar" : "Editar links"}</button></p>
              {!editLinks && <div className="grid grid-cols-2 gap-2">
                {([["Salesforce", deal.salesforceUrl, "#0070d2"], ["CRM (EOX)", deal.eoxUrl, "#692E81"]] as const).map(([label, url, brand]) => url
                  ? <a key={label} href={url} target="_blank" rel="noreferrer" style={{ background: brand, borderColor: brand }} className={`${btnGhost} w-full !text-white hover:brightness-110`}><ExternalLink size={15} aria-hidden /> {label}</a>
                  : <button key={label} type="button" onClick={() => setEditLinks(true)} className={`${btnGhost} w-full border-dashed !text-muted hover:!text-ink`}><Plus size={15} aria-hidden /> {label}</button>)}
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

        <div className="grid items-start gap-4 xl:grid-cols-2">
        {mine && deal.sellerId && !closed && (
          <>
            <SectionCard icon={NotebookPen} title="Registrar andamento">
              <div role="tablist" className="flex flex-wrap gap-2">
                {([["contato", "Contato feito", PhoneCall], ["nota", "Anotação", NotebookPen], ["encerrar", "Encerrar", Trophy]] as const).map(([k, l, I]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${tab === k ? "border-transparent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
                ))}
              </div>
              {tab === "contato" && (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kinds, note, nextAt: nextAt || null, nextNote: nextNote || null }), undefined, reset); }}>
                  <p className="text-xs text-muted">Marque todos os meios usados neste contato.</p>
                  <div className="flex flex-wrap gap-2">
                    {([["ligacao", "Ligação", PhoneCall], ["whatsapp", "WhatsApp", MessageCircle], ["email", "E-mail", Mail]] as const).map(([k, l, I]) => (
                      <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => setKinds((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]))} className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${kinds.includes(k) ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}><I size={15} aria-hidden />{l}</button>
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
              {tab === "nota" && (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => logContactAction(deal.id, { kinds: ["nota"], note, nextAt: null, nextNote: null }), undefined, reset); }}>
                  <textarea className={`${inputCls} min-h-24`} placeholder="Anotação (não conta como contato)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className={btnPrimary} disabled={pending}><Check size={16} aria-hidden /> Salvar anotação</button>
                </form>
              )}
              {tab === "encerrar" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-ok/40 p-4">
                    <p className="flex items-center gap-2 font-semibold text-ok"><Trophy size={16} aria-hidden /> Venda fechada</p>
                    <input className={inputCls} inputMode="decimal" placeholder="Valor fechado (R$)" aria-label="Valor fechado" value={f.closedValue} onChange={(e) => set("closedValue", e.target.value)} />
                    <input className={inputCls} inputMode="decimal" placeholder="Valor real após impostos (R$)" aria-label="Valor real após impostos" value={f.realValue} onChange={(e) => set("realValue", e.target.value)} />
                    <DateInput label="Data fechada" value={f.closedOn} onChange={(v) => set("closedOn", v)} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isReactivation} onChange={(e) => set("isReactivation", e.target.checked)} /> Cliente reativado (voltou a comprar)</label>
                    <button type="button" className={`${btnPrimary} w-full`} disabled={pending} onClick={() => run(() => closeDealAction(deal.id, { won: true, value: f.closedValue || (lastQuote?.totalCents ? brl(lastQuote.totalCents) : ""), closedOn: f.closedOn || null, data: { isReactivation: f.isReactivation, orderNumber: f.orderNumber, realValue: f.realValue } }))}>Fechar venda</button>
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



        {(mine && deal.sellerId) && (
          <SectionCard icon={Package} title="Dados da negociação">
            <form className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveDealDataAction(deal.id, f)); }}>
              <Field label="Frete"><select className={inputCls} value={f.freight} onChange={(e) => set("freight", e.target.value)}><option value="">—</option><option>CIF</option><option>FOB</option><option>RED</option></select></Field>
              <Field label="Código SAP"><input className={inputCls} value={f.sapCode} onChange={(e) => set("sapCode", e.target.value)} /></Field>
              <Field label="Condição de pagamento"><select className={inputCls} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}><option value="">—</option>{[...new Set([...(f.paymentTerms ? [f.paymentTerms] : []), ...termList])].map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Nº da cotação"><input className={`${inputCls} opacity-70`} readOnly value={f.quoteNumber} /></Field>
              <Field label="Data da cotação"><input className={`${inputCls} opacity-70`} readOnly value={f.quoteDate ? f.quoteDate.split("-").reverse().join("/") : ""} /></Field>
              <Field label="Valor sem impostos (R$)" hint="Total − IPI − ICMS da última cotação."><input className={`${inputCls} opacity-70`} readOnly value={brl(deal.netValueCents)} /></Field>
              <Field label="Total com impostos (R$)"><input className={`${inputCls} opacity-70`} readOnly value={f.quoteValue} /></Field>
              <Field label="Nº do pedido"><input className={inputCls} value={f.orderNumber} onChange={(e) => set("orderNumber", e.target.value)} /></Field>
              <Field label="Data fechada"><DateInput label="Data fechada" value={f.closedOn} onChange={(v) => set("closedOn", v)} /></Field>
              <Field label="Valor fechado (R$)"><input className={inputCls} inputMode="decimal" value={f.closedValue} onChange={(e) => set("closedValue", e.target.value)} /></Field>
              <Field label="Valor real (R$)" hint="Opcional. Se vazio, conta o valor sem impostos."><input className={inputCls} inputMode="decimal" value={f.realValue} onChange={(e) => set("realValue", e.target.value)} /></Field>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3 sm:col-span-2">
                <label className="flex items-center gap-2"><input type="checkbox" checked={f.isReactivation} onChange={(e) => set("isReactivation", e.target.checked)} /> Cliente reativado (conta na meta de reativados)</label>
                <button className={btnPrimary} disabled={pending}><Check size={16} aria-hidden /> Salvar dados</button>
              </div>
            </form>
          </SectionCard>
        )}
        </div>

        {mine && deal.sellerId && (
          <SectionCard icon={FileText} title={`Cotações${quotes.length ? ` (${quotes.length})` : ""}`}>
            <div className="space-y-3">
              {quotes.map((q, n) => <QuoteCard key={q.id} dealId={deal.id} q={q} terms={termList} onTerm={addTerm} leadCnpj={deal.cnpj ?? ""} editable={!closed} isLast={n === 0} />)}
              {quotes.length === 0 && !newQuote && <p className="text-sm text-muted">Nenhuma cotação enviada ainda.</p>}
              {newQuote
                ? <QuoteEditor dealId={deal.id} terms={termList} onTerm={addTerm} leadCnpj={deal.cnpj ?? ""} onClose={() => setNewQuote(false)} />
                : !closed && <button type="button" className={btnPrimary} onClick={() => setNewQuote(true)}><Plus size={16} aria-hidden /> {quotes.length ? "Nova cotação" : "Registrar cotação"}</button>}
            </div>
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

      <ConfirmDialog open={confirm !== null} tone="danger" icon={Trash2} title={confirm === "delete" ? "Apagar esta negociação?" : "Resetar esta negociação?"} confirmLabel={confirm === "delete" ? "Sim, apagar" : "Sim, resetar"} busy={pending} onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); if (c === "delete") run(() => deleteDealAction(deal.id), undefined, () => router.push("/negociacoes")); else run(() => resetDealAction(deal.id)); }}>
        {confirm === "delete" ? "A negociação, as cotações e o histórico serão apagados. Um registro completo fica guardado na auditoria do admin." : "As cotações e o histórico serão apagados e a negociação volta ao início. Um registro completo fica na auditoria do admin."}
      </ConfirmDialog>
      <ConfirmDialog open={confirmLost} tone="danger" icon={XCircle} title="Marcar como perdida?" confirmLabel="Sim, perdida" busy={pending} onCancel={() => setConfirmLost(false)} onConfirm={() => { setConfirmLost(false); run(() => closeDealAction(deal.id, { won: false, reason })); }}>
        A negociação com {deal.company} será encerrada. Você pode reabri-la depois.
      </ConfirmDialog>
    </div>
  );
}
