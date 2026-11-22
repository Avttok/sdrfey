"use client";

import { BrandLink } from "@/components/brand-icons";
import { Check, ChevronDown, ChevronUp, ExternalLink, FileText, FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DateInput } from "@/components/date-input";
import { useToast } from "@/components/toast";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { fmtBRL, parseMoneyToCents } from "@/config/deals";
import { fmtDate } from "@/lib/format";
import { deleteQuoteAction, lookupProductAction, saveQuoteAction } from "@/modules/quotes/actions";
import type { QuoteItem } from "@/modules/quotes/parse";
import { readQuotePdfAction } from "@/modules/quotes/read";
import { parsePctInput } from "@/modules/quotes/icms";
import { fmtQty, isCento, unitsOf } from "@/modules/quotes/units";

export type QuoteView = {
  id: number; number: string | null; quoteDate: string | null; totalCents: number | null; productsCents: number | null; ipiCents: number | null; icmsCents: number | null; netCents: number | null; freightCents: number | null; weightKg: number | null; icmsPct?: number | null;
  freight: "CIF" | "FOB" | "RED" | null; paymentTerms: string | null; validityDays: number | null; note: string | null; link: string | null; outcome?: "faturado" | "perdido" | null; createdAt: string;
  items: (QuoteItem & { id: number })[];
};

const nf = new Intl.NumberFormat("pt-BR");
const brl = (c: number | null | undefined) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const num = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

type EItem = { productCode: string; description: string; kind: string | null; unit: string | null; clientRef: string | null; packQty: number | null; icmsCents: number | null; ipiCents: number | null; qty: string; unitStr: string };
const toE = (i: QuoteItem): EItem => ({ productCode: i.productCode, description: i.description, kind: i.kind, unit: i.unit, clientRef: i.clientRef, packQty: i.packQty, icmsCents: i.icmsCents, ipiCents: i.ipiCents, qty: String(i.qty).replace(".", ","), unitStr: brl(i.unitCents) });
const lineTotal = (e: EItem) => Math.round(num(e.qty) * (parseMoneyToCents(e.unitStr) ?? 0));

/** Peso em kg no padrão brasileiro: 1.423,94 kg. */
export const fmtKg = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;

/** Valor principal = sem impostos (total − IPI − ICMS), que é o que conta para o vendedor. O total com impostos é secundário. */
export function QuoteValues({ q }: { q: Pick<QuoteView, "totalCents" | "productsCents" | "ipiCents" | "icmsCents" | "netCents" | "freightCents"> & { weightKg?: number | null } }) {
  const net = q.netCents ?? q.totalCents;
  const sub: [string, number | null][] = [["Total com impostos", q.totalCents], ["Frete", q.freightCents]];
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div><p className="text-[11px] font-medium text-muted">Valor sem impostos</p><p className="figure text-2xl font-bold leading-tight">{fmtBRL(net)}</p></div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1">{sub.filter(([, v]) => v).map(([l, v]) => <div key={l}><dt className="text-[11px] text-muted">{l}</dt><dd className="figure text-sm font-medium text-muted">{fmtBRL(v)}</dd></div>)}{q.weightKg ? <div><dt className="text-[11px] text-muted">Peso</dt><dd className="figure whitespace-nowrap text-sm font-medium text-muted">{fmtKg(q.weightKg)}</dd></div> : null}</dl>
    </div>
  );
}

/** Formulário de cotação (nova ou edição): dados, itens editáveis e leitura de PDF. */
export function QuoteEditor({ dealId, quote, terms, extraPct, icmsPct = null, onClose, onTerm, leadCnpj }: { dealId: number; quote?: QuoteView; terms: string[]; extraPct: number; /** Regra do Adm para a UF do cliente (null = vale o ICMS do PDF). */ icmsPct?: number | null; onClose: () => void; onTerm: (t: string) => void; leadCnpj: string }) {
  const { run, pending } = useRun();
  const toast = useToast();
  const [f, setF] = useState({
    number: quote?.number ?? "", date: quote?.quoteDate ?? "", freight: quote?.freight ?? "", paymentTerms: quote?.paymentTerms ?? "", validity: quote?.validityDays ? String(quote.validityDays) : "",
    freightValue: quote?.freightCents ? brl(quote.freightCents) : "", totalValue: quote && !quote.items.length ? brl(quote.totalCents) : "", note: quote?.note ?? "", link: quote?.link ?? "", weight: quote?.weightKg != null ? String(quote.weightKg).replace(".", ",") : "", icms: quote?.icmsPct != null ? String(quote.icmsPct).replace(".", ",") : "", days: 2,
  });
  const [items, setItems] = useState<EItem[]>(quote?.items.map(toE) ?? []);
  const [reading, setReading] = useState(false);
  const [netStr, setNetStr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const setItem = (n: number, patch: Partial<EItem>) => setItems((p) => p.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const productsSum = items.reduce((a, e) => a + lineTotal(e), 0);
  const ipiSum = items.reduce((a, e) => a + (e.ipiCents ?? 0), 0);
  const icmsOverride = parsePctInput(f.icms);
  const icmsEff = icmsOverride ?? icmsPct;
  const icmsSum = icmsEff != null ? Math.round(productsSum * icmsEff / 100) : items.reduce((a, e) => a + (e.icmsCents ?? 0), 0);
  const freightC = parseMoneyToCents(f.freightValue) ?? 0;
  /** Sem impostos calculado: (total − IPI − ICMS) menos o imposto extra (PIS/COFINS). */
  const calcNet = items.length ? Math.round((productsSum + freightC - icmsSum) * (1 - extraPct / 100)) : parseMoneyToCents(f.totalValue) ?? 0;
  const savedManual = !!quote && quote.netCents != null && Math.abs(quote.netCents - calcNet) > 1;
  const manualNet = netStr ?? (savedManual && items.length === quote!.items.length ? brl(quote!.netCents) : null);
  const netShown = manualNet ?? brl(calcNet);

  const readPdf = async (file: File) => {
    setReading(true);
    const fd = new FormData(); fd.set("file", file);
    const r = await readQuotePdfAction(fd).catch(() => ({ ok: false as const, message: "Não consegui ler esse PDF." }));
    setReading(false);
    if (!r.ok) return toast("bad", r.message);
    const q = r.quote;
    if (q.paymentTerms) onTerm(q.paymentTerms);
    setF((p) => ({ ...p, number: q.quoteNumber ?? p.number, date: q.quoteDate ?? p.date, freight: q.freight ?? p.freight, paymentTerms: q.paymentTerms ?? p.paymentTerms, validity: q.validityDays ? String(q.validityDays) : p.validity, freightValue: q.freightCents ? brl(q.freightCents) : "", totalValue: q.items.length ? "" : brl(q.totalCents), weight: q.weightKg != null ? String(q.weightKg).replace(".", ",") : p.weight }));
    if (q.items.length) setItems(q.items.map(toE));
    const other = q.cnpj && q.cnpj !== leadCnpj;
    toast(other ? "bad" : "ok", other ? "Atenção: o CNPJ do PDF é diferente do cliente desta negociação. Confira antes de salvar." : `PDF lido: cotação ${q.quoteNumber ?? "?"}, ${q.items.length} itens. Confira e salve. O arquivo não é guardado.`);
  };
  const lookup = async (n: number) => {
    const it = items[n];
    if (!it?.productCode.trim()) return;
    const p = await lookupProductAction(it.productCode).catch(() => null);
    if (p && !it.description.trim()) setItem(n, { description: p.description, kind: p.kind, unit: p.unit, unitStr: it.unitStr || brl(p.lastUnitCents) });
  };
  const save = () => run(() => saveQuoteAction(dealId, quote?.id ?? null, {
    number: f.number, date: f.date, freight: f.freight, paymentTerms: f.paymentTerms, validityDays: f.validity ? Number(f.validity) : null, note: f.note, freightValue: f.freightValue, totalValue: f.totalValue, netValue: manualNet ?? "", link: f.link, weight: f.weight, icmsPct: f.icms, followupDays: f.days,
    items: items.map((e, n) => ({ seq: (n + 1) * 10, productCode: e.productCode, clientRef: e.clientRef, description: e.description, kind: e.kind ?? (e.description.split(" ")[0]?.toUpperCase() || null), qty: num(e.qty), packQty: e.packQty, unit: e.unit, icmsCents: e.icmsCents, ipiCents: e.ipiCents, unitCents: parseMoneyToCents(e.unitStr), totalCents: lineTotal(e) })),
  }), undefined, onClose);

  const lab = "flex min-w-0 flex-col gap-1 text-xs font-medium text-muted";
  const cell = `${inputCls} !h-10 !min-h-10 !px-2.5 !py-0 text-[13px]`;
  const COLS = "grid grid-cols-[6.5rem_minmax(14rem,1fr)_5.5rem_7.5rem_8rem_2.25rem] items-center gap-2";
  return (
    <div className="space-y-5 rounded-xl border border-accent/40 bg-sunk/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex-1 font-semibold">{quote ? `Editar cotação ${quote.number ?? ""}` : "Nova cotação"}</h3>
        <label className={`${btnGhost} cursor-pointer`}><FileUp size={16} aria-hidden /> {reading ? "Lendo…" : "Ler PDF"}<input type="file" accept="application/pdf" className="sr-only" disabled={reading} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void readPdf(file); }} /></label>
        <button type="button" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden /></button>
      </div>
      <div className="grid gap-x-3 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className={lab}>Nº da cotação<input className={inputCls} value={f.number} onChange={(e) => set("number", e.target.value)} /></label>
        <div className={lab}>Data da cotação<DateInput label="Data da cotação" value={f.date} onChange={(v) => set("date", v)} /></div>
        <label className={lab}>Frete<select className={inputCls} value={f.freight} onChange={(e) => set("freight", e.target.value)}><option value="">—</option><option>CIF</option><option>FOB</option><option>RED</option></select></label>
        <label className={lab}>Condição de pagamento
          <select className={inputCls} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}><option value="">—</option>{[...new Set([...(f.paymentTerms ? [f.paymentTerms] : []), ...terms])].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className={lab}>Validade (dias)<input className={inputCls} inputMode="numeric" value={f.validity} onChange={(e) => set("validity", e.target.value.replace(/\D/g, ""))} /></label>
        <label className={lab}>Frete negociado (R$)<input className={inputCls} inputMode="decimal" value={f.freightValue} onChange={(e) => set("freightValue", e.target.value)} /></label>
        <label className={lab}>Peso total (kg)<input className={inputCls} inputMode="decimal" placeholder="Ex.: 423,94" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></label>
        <label className={`${lab} sm:col-span-2`}>Link da cotação (Salesforce)<input className={inputCls} type="url" placeholder="https://…" value={f.link} onChange={(e) => set("link", e.target.value)} /></label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">Produtos {items.length > 0 && `(${items.length})`}</p>
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <div className="min-w-[44rem] space-y-2 p-3">
              <div className={`${COLS} text-xs font-medium text-muted`}><span>Código</span><span>Descrição</span><span className="text-right">Qtd</span><span className="text-right">Unitário</span><span className="text-right">Total</span><span /></div>
              {items.map((e, n) => (
                <div key={n} className={COLS}>
                  <input aria-label="Código" className={cell} value={e.productCode} onChange={(x) => setItem(n, { productCode: x.target.value })} onBlur={() => lookup(n)} />
                  <input aria-label="Descrição" className={cell} value={e.description} onChange={(x) => setItem(n, { description: x.target.value, kind: x.target.value.split(" ")[0]?.toUpperCase() || null })} />
                  <div className="relative"><input aria-label="Quantidade" title={isCento(e.unit) ? `${unitsOf(num(e.qty), e.unit).toLocaleString("pt-BR")} unidades (quantidade em cento)` : undefined} inputMode="decimal" className={`${cell} w-full text-right`} value={e.qty} onChange={(x) => setItem(n, { qty: x.target.value })} />{isCento(e.unit) && <span className="pointer-events-none absolute -bottom-3.5 right-1 text-[10px] text-muted">= {unitsOf(num(e.qty), e.unit).toLocaleString("pt-BR")} un</span>}</div>
                  <input aria-label="Preço unitário" inputMode="decimal" className={`${cell} text-right`} value={e.unitStr} onChange={(x) => setItem(n, { unitStr: x.target.value })} />
                  <span className="figure flex h-10 items-center justify-end rounded-lg bg-sunk/60 px-2.5 text-[13px] font-medium">{brl(lineTotal(e))}</span>
                  <button type="button" aria-label="Remover item" className="grid size-9 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setItems((p) => p.filter((_, i) => i !== n))}><Trash2 size={15} aria-hidden /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        <button type="button" className={btnGhost} onClick={() => setItems((p) => [...p, { productCode: "", description: "", kind: null, unit: "CEN", clientRef: null, packQty: null, icmsCents: null, ipiCents: null, qty: "1", unitStr: "" }])}><Plus size={15} aria-hidden /> Adicionar produto</button>
        {items.length === 0 && (
          <label className={`${lab} max-w-xs`}>Valor total da cotação (R$), se não for listar os produtos<input className={inputCls} inputMode="decimal" placeholder="12.500,00" value={f.totalValue} onChange={(e) => set("totalValue", e.target.value)} /></label>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border border-line bg-panel p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2 text-sm">
          {items.length > 0 && <p className="flex items-baseline justify-between gap-4"><span className="font-medium">Total com impostos</span><span className="figure font-medium">{brl(productsSum + ipiSum + freightC)}</span></p>}
          <details className="text-xs text-muted"><summary className="cursor-pointer select-none hover:text-ink">Ver como o valor sem impostos é calculado</summary>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {items.length > 0 && <><dt>Produtos (preço já com ICMS)</dt><dd className="figure text-right">{brl(productsSum)}</dd></>}
              {ipiSum > 0 && <><dt>+ IPI</dt><dd className="figure text-right">{brl(ipiSum)}</dd></>}
              {freightC > 0 && <><dt>+ Frete</dt><dd className="figure text-right">{brl(freightC)}</dd></>}
              {items.length > 0 && <><dt>− ICMS{icmsEff != null ? ` (${String(icmsEff).replace(".", ",")}%)` : " (do PDF)"}</dt><dd className="figure text-right">{brl(icmsSum)}</dd></>}
              {items.length > 0 && extraPct > 0 && <><dt>− PIS/COFINS ({String(extraPct).replace(".", ",")}%)</dt><dd className="figure text-right">sobre o restante</dd></>}
            </dl>
          </details>
          <label className="block text-xs text-muted">ICMS % desta cotação (opcional)
            <input aria-label="ICMS percentual" className={`${inputCls} !w-28 text-right`} inputMode="decimal" placeholder={icmsPct != null ? String(icmsPct).replace(".", ",") : "do PDF"} value={f.icms} onChange={(e) => set("icms", e.target.value)} />
          </label>
        </div>
        <label className={`${lab} sm:w-56`}>Valor sem impostos (R$)
          <input className={`${inputCls} text-right text-base font-bold`} inputMode="decimal" value={netShown} onChange={(e) => setNetStr(e.target.value)} />
          <span className="font-normal">{manualNet !== null ? <button type="button" className="text-accent hover:underline" onClick={() => setNetStr(null)}>Voltar ao valor calculado ({brl(calcNet)})</button> : "Calculado. Pode corrigir com o valor do Salesforce."}</span>
        </label>
      </div>
      <textarea className={`${inputCls} min-h-16`} placeholder="Observações da cotação (opcional)" value={f.note} onChange={(e) => set("note", e.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!quote ? <label className="flex items-center gap-2 text-sm text-muted">Cobrar em <input type="number" min={1} max={30} className={`${inputCls} !w-20`} value={f.days} onChange={(e) => set("days", Number(e.target.value))} /> dias</label> : <span />}
        <div className="flex gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancelar</button><button type="button" className={btnPrimary} disabled={pending} onClick={save}><Check size={16} aria-hidden /> {quote ? "Salvar cotação" : "Registrar cotação"}</button></div>
      </div>
    </div>
  );
}

/** Um card por cotação enviada. */
export function QuoteCard({ dealId, q, terms, extraPct, icmsPct = null, onTerm, leadCnpj, editable, isLast }: { dealId: number; q: QuoteView; terms: string[]; extraPct: number; icmsPct?: number | null; onTerm: (t: string) => void; leadCnpj: string; editable: boolean; isLast: boolean }) {
  const { run, pending } = useRun();
  const [edit, setEdit] = useState(false);
  const [show, setShow] = useState(false);
  const [del, setDel] = useState(false);
  if (edit) return <QuoteEditor dealId={dealId} quote={q} extraPct={extraPct} icmsPct={icmsPct} terms={terms} onTerm={onTerm} leadCnpj={leadCnpj} onClose={() => setEdit(false)} />;
  return (
    <article className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warn/15 text-warn"><FileText size={17} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">Cotação {q.number ?? `#${q.id}`}{isLast && <span className="ml-2 rounded-full bg-accent/12 px-2 py-0.5 align-middle text-[11px] font-semibold text-accent">Mais recente</span>}{q.outcome === "faturado" && <span className="ml-2 rounded-full bg-ok/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-ok">Faturada</span>}{q.outcome === "perdido" && <span className="ml-2 rounded-full bg-danger/12 px-2 py-0.5 align-middle text-[11px] font-semibold text-danger">Perdida</span>}</h3>
          <p className="text-xs text-muted">{q.quoteDate ? fmtDate(q.quoteDate) : fmtDate(q.createdAt)}{q.freight ? ` · Frete ${q.freight}` : ""}{q.paymentTerms ? ` · ${q.paymentTerms}` : ""}{q.validityDays ? ` · validade ${q.validityDays} dias` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">{q.link && <BrandLink kind="sf" small href={q.link} label="Abrir no Salesforce" />}{editable && <><button type="button" className={`${btnGhost} !min-h-9 !px-3 !text-sm`} onClick={() => setEdit(true)}><Pencil size={14} aria-hidden /> Editar</button><button type="button" aria-label="Apagar cotação" className={`${btnGhost} !min-h-9 !px-2.5 text-danger`} disabled={pending} onClick={() => setDel(true)}><Trash2 size={15} aria-hidden /></button></>}</div>
      </header>
      <QuoteValues q={q} />
      {q.note && <p className="whitespace-pre-wrap rounded-lg bg-sunk px-3 py-2 text-sm text-muted">{q.note}</p>}
      {q.items.length > 0 && (
        <>
          <button type="button" onClick={() => setShow(!show)} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline" aria-expanded={show}>{show ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />} {show ? "Esconder" : "Ver"} {q.items.length} {q.items.length === 1 ? "produto" : "produtos"}</button>
          {show && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-xs text-muted"><th className="pb-2 pr-2 font-medium">Cód.</th><th className="pb-2 font-medium">Descrição</th><th className="hidden pb-2 font-medium sm:table-cell">Tipo</th><th className="pb-2 text-right font-medium">Qtd</th><th className="pb-2 pl-3 text-right font-medium">Unitário</th><th className="pb-2 pl-3 text-right font-medium">Total</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {q.items.map((i) => (
                    <tr key={i.id}>
                      <td className="figure py-2 pr-2 font-semibold">{i.productCode}</td>
                      <td className="py-2 pr-2">{i.description}{i.clientRef && <span className="block text-xs text-muted">{i.clientRef}</span>}</td>
                      <td className="hidden py-2 pr-3 text-xs capitalize text-muted sm:table-cell">{i.kind?.toLowerCase() ?? "—"}</td>
                      <td className="figure whitespace-nowrap py-2 text-right">{fmtQty(i.qty, i.unit)}</td>
                      <td className="figure py-2 pl-3 text-right">{brl(i.unitCents)}</td>
                      <td className="figure py-2 pl-3 text-right font-medium">{brl(i.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <ConfirmDialog open={del} tone="danger" icon={Trash2} title="Apagar esta cotação?" confirmLabel="Sim, apagar" busy={pending} onCancel={() => setDel(false)} onConfirm={() => { setDel(false); run(() => deleteQuoteAction(dealId, q.id)); }}>
        A cotação {q.number ?? ""} e os produtos dela serão apagados. Fica registrado no histórico.
      </ConfirmDialog>
    </article>
  );
}
