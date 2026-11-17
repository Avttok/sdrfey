"use client";

import { Check, ChevronDown, ChevronUp, FileText, FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
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

export type QuoteView = {
  id: number; number: string | null; quoteDate: string | null; totalCents: number | null; productsCents: number | null; ipiCents: number | null; icmsCents: number | null; netCents: number | null; freightCents: number | null;
  freight: "CIF" | "FOB" | "RED" | null; paymentTerms: string | null; validityDays: number | null; note: string | null; createdAt: string;
  items: (QuoteItem & { id: number })[];
};

const nf = new Intl.NumberFormat("pt-BR");
const brl = (c: number | null | undefined) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const num = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

type EItem = { productCode: string; description: string; kind: string | null; unit: string | null; clientRef: string | null; packQty: number | null; icmsCents: number | null; ipiCents: number | null; qty: string; unitStr: string };
const toE = (i: QuoteItem): EItem => ({ productCode: i.productCode, description: i.description, kind: i.kind, unit: i.unit, clientRef: i.clientRef, packQty: i.packQty, icmsCents: i.icmsCents, ipiCents: i.ipiCents, qty: String(i.qty).replace(".", ","), unitStr: brl(i.unitCents) });
const lineTotal = (e: EItem) => Math.round(num(e.qty) * (parseMoneyToCents(e.unitStr) ?? 0));

/** Valor principal = sem impostos (total − IPI − ICMS), que é o que conta para o vendedor. O total com impostos é secundário. */
export function QuoteValues({ q }: { q: Pick<QuoteView, "totalCents" | "productsCents" | "ipiCents" | "icmsCents" | "netCents" | "freightCents"> }) {
  const net = q.netCents ?? q.totalCents;
  const sub: [string, number | null][] = [["Total com impostos", q.totalCents], ["IPI", q.ipiCents], ["ICMS", q.icmsCents], ["Frete", q.freightCents]];
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div><p className="text-[11px] font-medium text-muted">Valor sem impostos</p><p className="figure text-2xl font-bold leading-tight">{fmtBRL(net)}</p></div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1">{sub.filter(([, v]) => v).map(([l, v]) => <div key={l}><dt className="text-[11px] text-muted">{l}</dt><dd className="figure text-sm font-medium text-muted">{fmtBRL(v)}</dd></div>)}</dl>
    </div>
  );
}

/** Formulário de cotação (nova ou edição): dados, itens editáveis e leitura de PDF. */
export function QuoteEditor({ dealId, quote, terms, onClose, onTerm, leadCnpj }: { dealId: number; quote?: QuoteView; terms: string[]; onClose: () => void; onTerm: (t: string) => void; leadCnpj: string }) {
  const { run, pending } = useRun();
  const toast = useToast();
  const [f, setF] = useState({
    number: quote?.number ?? "", date: quote?.quoteDate ?? "", freight: quote?.freight ?? "", paymentTerms: quote?.paymentTerms ?? "", validity: quote?.validityDays ? String(quote.validityDays) : "",
    freightValue: quote?.freightCents ? brl(quote.freightCents) : "", totalValue: quote && !quote.items.length ? brl(quote.totalCents) : "", note: quote?.note ?? "", days: 2,
  });
  const [items, setItems] = useState<EItem[]>(quote?.items.map(toE) ?? []);
  const [reading, setReading] = useState(false);
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const setItem = (n: number, patch: Partial<EItem>) => setItems((p) => p.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const productsSum = items.reduce((a, e) => a + lineTotal(e), 0);
  const ipiSum = items.reduce((a, e) => a + (e.ipiCents ?? 0), 0);
  const icmsSum = items.reduce((a, e) => a + (e.icmsCents ?? 0), 0);
  const freightC = parseMoneyToCents(f.freightValue) ?? 0;

  const readPdf = async (file: File) => {
    setReading(true);
    const fd = new FormData(); fd.set("file", file);
    const r = await readQuotePdfAction(fd).catch(() => ({ ok: false as const, message: "Não consegui ler esse PDF." }));
    setReading(false);
    if (!r.ok) return toast("bad", r.message);
    const q = r.quote;
    if (q.paymentTerms) onTerm(q.paymentTerms);
    setF((p) => ({ ...p, number: q.quoteNumber ?? p.number, date: q.quoteDate ?? p.date, freight: q.freight ?? p.freight, paymentTerms: q.paymentTerms ?? p.paymentTerms, validity: q.validityDays ? String(q.validityDays) : p.validity, freightValue: q.freightCents ? brl(q.freightCents) : "", totalValue: q.items.length ? "" : brl(q.totalCents) }));
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
    number: f.number, date: f.date, freight: f.freight, paymentTerms: f.paymentTerms, validityDays: f.validity ? Number(f.validity) : null, note: f.note, freightValue: f.freightValue, totalValue: f.totalValue, followupDays: f.days,
    items: items.map((e, n) => ({ seq: (n + 1) * 10, productCode: e.productCode, clientRef: e.clientRef, description: e.description, kind: e.kind ?? (e.description.split(" ")[0]?.toUpperCase() || null), qty: num(e.qty), packQty: e.packQty, unit: e.unit, icmsCents: e.icmsCents, ipiCents: e.ipiCents, unitCents: parseMoneyToCents(e.unitStr), totalCents: lineTotal(e) })),
  }), undefined, onClose);

  return (
    <div className="space-y-4 rounded-xl border border-accent/40 bg-sunk/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex-1 font-semibold">{quote ? `Editar cotação ${quote.number ?? ""}` : "Nova cotação"}</h3>
        <label className={`${btnGhost} cursor-pointer`}><FileUp size={16} aria-hidden /> {reading ? "Lendo…" : "Ler PDF"}<input type="file" accept="application/pdf" className="sr-only" disabled={reading} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void readPdf(file); }} /></label>
        <button type="button" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden /></button>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted">Nº da cotação</span><input className={inputCls} value={f.number} onChange={(e) => set("number", e.target.value)} /></label>
        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-muted">Data da cotação</span><DateInput label="Data da cotação" value={f.date} onChange={(v) => set("date", v)} /></div>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted">Frete</span><select className={inputCls} value={f.freight} onChange={(e) => set("freight", e.target.value)}><option value="">—</option><option>CIF</option><option>FOB</option><option>RED</option></select></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted">Condição de pagamento</span>
          <select className={inputCls} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}><option value="">—</option>{[...new Set([...(f.paymentTerms ? [f.paymentTerms] : []), ...terms])].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted">Validade (dias)</span><input className={inputCls} inputMode="numeric" value={f.validity} onChange={(e) => set("validity", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted">Frete negociado (R$)</span><input className={inputCls} inputMode="decimal" value={f.freightValue} onChange={(e) => set("freightValue", e.target.value)} /></label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">Produtos {items.length > 0 && `(${items.length})`}</p>
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-xs text-muted"><th className="p-2 font-medium">Cód.</th><th className="p-2 font-medium">Descrição</th><th className="p-2 text-right font-medium">Qtd</th><th className="p-2 text-right font-medium">Unitário</th><th className="p-2 text-right font-medium">Total</th><th className="w-8" /></tr></thead>
              <tbody className="divide-y divide-line">
                {items.map((e, n) => (
                  <tr key={n}>
                    <td className="p-1.5"><input aria-label="Código" className={`${inputCls} !min-h-9 !w-24 !px-2 !py-1 text-[13px]`} value={e.productCode} onChange={(x) => setItem(n, { productCode: x.target.value })} onBlur={() => lookup(n)} /></td>
                    <td className="p-1.5"><input aria-label="Descrição" className={`${inputCls} !min-h-9 !px-2 !py-1 text-[13px]`} value={e.description} onChange={(x) => setItem(n, { description: x.target.value, kind: x.target.value.split(" ")[0]?.toUpperCase() || null })} /></td>
                    <td className="p-1.5"><input aria-label="Quantidade" inputMode="decimal" className={`${inputCls} !min-h-9 !w-20 !px-2 !py-1 text-right text-[13px]`} value={e.qty} onChange={(x) => setItem(n, { qty: x.target.value })} /></td>
                    <td className="p-1.5"><input aria-label="Preço unitário" inputMode="decimal" className={`${inputCls} !min-h-9 !w-24 !px-2 !py-1 text-right text-[13px]`} value={e.unitStr} onChange={(x) => setItem(n, { unitStr: x.target.value })} /></td>
                    <td className="figure whitespace-nowrap p-1.5 text-right font-medium">{brl(lineTotal(e))}</td>
                    <td className="p-1.5"><button type="button" aria-label="Remover item" className="grid size-8 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setItems((p) => p.filter((_, i) => i !== n))}><Trash2 size={15} aria-hidden /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="p-2 text-right text-xs text-muted">Produtos (preço já com ICMS)</td><td className="figure p-2 text-right">{brl(productsSum)}</td><td /></tr>
                {ipiSum > 0 && <tr><td colSpan={4} className="px-2 pb-1 text-right text-xs text-muted">+ IPI</td><td className="figure px-2 pb-1 text-right">{brl(ipiSum)}</td><td /></tr>}
                {freightC > 0 && <tr><td colSpan={4} className="px-2 pb-1 text-right text-xs text-muted">+ Frete</td><td className="figure px-2 pb-1 text-right">{brl(freightC)}</td><td /></tr>}
                <tr><td colSpan={4} className="px-2 pb-1 text-right text-xs text-muted">Total com impostos</td><td className="figure px-2 pb-1 text-right">{brl(productsSum + ipiSum + freightC)}</td><td /></tr>
                {(ipiSum > 0 || icmsSum > 0) && <tr><td colSpan={4} className="px-2 pb-1 text-right text-xs text-muted">− IPI − ICMS ({brl(icmsSum)})</td><td /><td /></tr>}
                <tr><td colSpan={4} className="px-2 pb-2 text-right text-xs font-semibold">Valor sem impostos</td><td className="figure px-2 pb-2 text-right text-base font-bold">{brl(productsSum + freightC - icmsSum)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        )}
        <button type="button" className={btnGhost} onClick={() => setItems((p) => [...p, { productCode: "", description: "", kind: null, unit: "CEN", clientRef: null, packQty: null, icmsCents: null, ipiCents: null, qty: "1", unitStr: "" }])}><Plus size={15} aria-hidden /> Adicionar produto</button>
        {items.length === 0 && (
          <label className="flex max-w-xs flex-col gap-1 text-sm"><span className="text-xs font-medium text-muted">Valor total da cotação (R$), se não for listar os produtos</span><input className={inputCls} inputMode="decimal" placeholder="12.500,00" value={f.totalValue} onChange={(e) => set("totalValue", e.target.value)} /></label>
        )}
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
export function QuoteCard({ dealId, q, terms, onTerm, leadCnpj, editable, isLast }: { dealId: number; q: QuoteView; terms: string[]; onTerm: (t: string) => void; leadCnpj: string; editable: boolean; isLast: boolean }) {
  const { run, pending } = useRun();
  const [edit, setEdit] = useState(false);
  const [show, setShow] = useState(false);
  const [del, setDel] = useState(false);
  if (edit) return <QuoteEditor dealId={dealId} quote={q} terms={terms} onTerm={onTerm} leadCnpj={leadCnpj} onClose={() => setEdit(false)} />;
  return (
    <article className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warn/15 text-warn"><FileText size={17} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">Cotação {q.number ?? `#${q.id}`}{isLast && <span className="ml-2 rounded-full bg-accent/12 px-2 py-0.5 align-middle text-[11px] font-semibold text-accent">Mais recente</span>}</h3>
          <p className="text-xs text-muted">{q.quoteDate ? fmtDate(q.quoteDate) : fmtDate(q.createdAt)}{q.freight ? ` · Frete ${q.freight}` : ""}{q.paymentTerms ? ` · ${q.paymentTerms}` : ""}{q.validityDays ? ` · validade ${q.validityDays} dias` : ""}</p>
        </div>
        {editable && <div className="flex gap-1.5"><button type="button" className={`${btnGhost} !min-h-9 !px-3 !text-sm`} onClick={() => setEdit(true)}><Pencil size={14} aria-hidden /> Editar</button><button type="button" aria-label="Apagar cotação" className={`${btnGhost} !min-h-9 !px-2.5 text-danger`} disabled={pending} onClick={() => setDel(true)}><Trash2 size={15} aria-hidden /></button></div>}
      </header>
      <QuoteValues q={q} />
      {q.note && <p className="whitespace-pre-wrap rounded-lg bg-sunk px-3 py-2 text-sm text-muted">{q.note}</p>}
      {q.items.length > 0 && (
        <>
          <button type="button" onClick={() => setShow(!show)} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline" aria-expanded={show}>{show ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />} {show ? "Esconder" : "Ver"} {q.items.length} {q.items.length === 1 ? "produto" : "produtos"}</button>
          {show && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-xs text-muted"><th className="pb-2 pr-2 font-medium">Cód.</th><th className="pb-2 font-medium">Descrição</th><th className="hidden pb-2 font-medium sm:table-cell">Tipo</th><th className="pb-2 text-right font-medium">Qtd</th><th className="pb-2 pl-3 text-right font-medium">Unitário</th><th className="hidden pb-2 pl-3 text-right font-medium md:table-cell">ICMS</th><th className="pb-2 pl-3 text-right font-medium">Total</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {q.items.map((i) => (
                    <tr key={i.id}>
                      <td className="figure py-2 pr-2 font-semibold">{i.productCode}</td>
                      <td className="py-2 pr-2">{i.description}{i.clientRef && <span className="block text-xs text-muted">{i.clientRef}</span>}</td>
                      <td className="hidden py-2 pr-3 text-xs capitalize text-muted sm:table-cell">{i.kind?.toLowerCase() ?? "—"}</td>
                      <td className="figure whitespace-nowrap py-2 text-right">{nf.format(i.qty)}{i.unit ? ` ${i.unit}` : ""}</td>
                      <td className="figure py-2 pl-3 text-right">{brl(i.unitCents)}</td>
                      <td className="figure hidden py-2 pl-3 text-right text-muted md:table-cell">{brl(i.icmsCents)}</td>
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
