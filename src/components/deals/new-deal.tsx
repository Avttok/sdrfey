"use client";

import { Check, FileUp, Loader2, History, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { DateInput } from "@/components/date-input";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtBRL } from "@/config/deals";
import { fmtDateTime, fmtPhone } from "@/lib/format";
import { consultCnpjAction, createDealManualAction, lookupCnpjAction, type CnpjConsult, type CnpjLookup } from "@/modules/deals/actions";
import type { QuoteItem } from "@/modules/quotes/parse";
import { readQuotePdfAction } from "@/modules/quotes/read";
import { ColorPicker } from "./color-picker";

const maskCnpj = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 14); return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2"); };
const brl = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const EMPTY = { cnpj: "", company: "", contactName: "", phone: "", email: "", street: "", neighborhood: "", zip: "", stateReg: "", city: "", uf: "", note: "", freight: "", sapCode: "", orderNumber: "", quoteNumber: "", quoteDate: "", quoteValue: "", paymentTerms: "", isReactivation: false };

/** “Nova negociação”: o vendedor abre uma negociação sem passar pelo SDR. CNPJ obrigatório; se já existir no banco, traz o cadastro e o atendimento. */
export function NewDeal({ terms }: { terms: string[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [color, setColor] = useState<string | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [look, setLook] = useState<CnpjLookup | null>(null);
  const [consult, setConsult] = useState<CnpjConsult | null>(null);
  const [phase, setPhase] = useState<"idle" | "db" | "receita">("idle");
  const [busy, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [reading, setReading] = useState(false);
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const close = () => { setOpen(false); setF(EMPTY); setItems([]); setLook(null); setConsult(null); setPhase("idle"); setColor(null); };

  /** Busca no banco e, se o CNPJ é novo (ou nunca foi consultado), já consulta a Receita sozinho. */
  const search = async (cnpj = f.cnpj) => {
    setConsult(null); setLook(null); setPhase("db");
    const r = await lookupCnpjAction(cnpj).catch(() => ({ ok: false as const, message: "Não consegui pesquisar agora. Tente de novo." }));
    setLook(r);
    if (!r.ok) { setPhase("idle"); return toast("bad", r.message); }
    if (r.found) { const l = r.lead; setF((p) => ({ ...p, contactName: p.contactName || l.contactName || "", phone: p.phone || l.phones[0] || "", email: p.email || l.email || "", street: p.street || l.address || "", neighborhood: p.neighborhood || l.neighborhood || "", zip: p.zip || l.zip || "", stateReg: p.stateReg || l.stateReg || "", city: p.city || l.city || "", uf: p.uf || l.uf || "", sapCode: p.sapCode || l.sapCode || "" })); }
    if (r.found && r.lead.enriched) return setPhase("idle");
    setPhase("receita");
    const c = await consultCnpjAction(cnpj).catch(() => ({ ok: true as const, info: null }));
    setConsult(c); setPhase("idle");
    if (c.ok && c.info) {
      const i = c.info;
      setF((p) => ({ ...p, company: p.company || i.tradeName || i.name || "", phone: p.phone || i.phones[0] || "", email: p.email || i.email || "", city: p.city || i.city || "", uf: p.uf || i.uf || "" }));
    }
  };
  useEffect(() => {
    if (open && f.cnpj.replace(/\D/g, "").length === 14 && phase === "idle" && !look) void search(f.cnpj);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.cnpj, open]);
  const readPdf = async (file: File) => {
    setReading(true);
    const fd = new FormData(); fd.set("file", file);
    const r = await readQuotePdfAction(fd).catch(() => ({ ok: false as const, message: "Não consegui ler esse PDF." }));
    setReading(false);
    if (!r.ok) return toast("bad", r.message);
    const q = r.quote;
    const cnpj = q.cnpj?.length === 14 ? maskCnpj(q.cnpj) : f.cnpj;
    setF((p) => ({ ...p, cnpj, company: q.clientName ?? p.company, quoteNumber: q.quoteNumber ?? "", quoteDate: q.quoteDate ?? "", freight: q.freight ?? "", sapCode: q.sapCode ?? "", paymentTerms: q.paymentTerms ?? "", quoteValue: brl(q.totalCents), email: q.email ?? p.email, phone: q.phone ?? p.phone, street: q.address ?? p.street, neighborhood: q.neighborhood ?? p.neighborhood, zip: q.zip ?? p.zip, stateReg: q.stateReg ?? p.stateReg, city: q.city ?? p.city, uf: q.uf ?? p.uf }));
    setItems(q.items);
    toast("ok", `PDF lido: cotação ${q.quoteNumber ?? "?"}, ${q.items.length} itens. O arquivo não é guardado.`);
    if (q.cnpj?.length === 14) search(cnpj);
  };
  const create = () => start(async () => {
    const r = await createDealManualAction({ cnpj: f.cnpj, company: f.company, contactName: f.contactName, phone: f.phone, email: f.email, address: { street: f.street || null, neighborhood: f.neighborhood || null, zip: f.zip || null, stateReg: f.stateReg || null, city: f.city || null, uf: f.uf || null }, note: f.note, color, items,
      data: { freight: f.freight, sapCode: f.sapCode, orderNumber: f.orderNumber, quoteNumber: f.quoteNumber, quoteDate: f.quoteDate, quoteValue: f.quoteValue, paymentTerms: f.paymentTerms, isReactivation: f.isReactivation } });
    if (!r.ok) return toast("bad", r.message);
    toast("ok", r.message ?? "Negociação criada.");
    close();
    if (r.id) router.push(`/negociacoes/${r.id}`);
  });

  const found = look?.ok && look.found ? look : null;
  const blocked = !!found?.openDeal || !!found?.leftPortfolio;
  const panel = (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" style={{ backgroundImage: "none" }} className={`${panelCls} mx-auto my-6 w-full max-w-3xl space-y-4 p-5 shadow-2xl sm:p-6`} aria-label="Nova negociação">
      <div className="flex items-center gap-3">
        <h2 className="display flex-1 text-xl">Nova negociação</h2>
        <label className={`${btnGhost} cursor-pointer`}><FileUp size={16} aria-hidden /> {reading ? "Lendo…" : "Começar por um PDF de cotação"}<input type="file" accept="application/pdf" className="sr-only" disabled={reading} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void readPdf(file); }} /></label>
        <button type="button" aria-label="Fechar" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk" onClick={close}><X size={18} aria-hidden /></button>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <label className="block min-w-64 flex-1 text-sm"><span className="mb-1 block text-muted">CNPJ do cliente (obrigatório)</span><input className={inputCls} inputMode="numeric" placeholder="00.000.000/0000-00" value={f.cnpj} onChange={(e) => { set("cnpj", maskCnpj(e.target.value)); setLook(null); setConsult(null); setPhase("idle"); }} /></label>
        <button className={btnGhost} disabled={phase !== "idle" || f.cnpj.replace(/\D/g, "").length < 14}><Search size={16} aria-hidden /> Pesquisar de novo</button>
      </form>
      {phase !== "idle" && <p role="status" className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2.5 text-sm"><Loader2 size={16} className="animate-spin text-accent" aria-hidden />{phase === "db" ? "Pesquisando no sistema…" : "CNPJ ainda não consultado: carregando dados da Receita Federal…"}</p>}

      {look?.ok && !look.found && phase === "idle" && (
        consult?.ok && consult.info
          ? <div className="space-y-0.5 rounded-xl border border-ok/40 bg-ok/8 p-4 text-sm"><p className="text-xs font-medium text-ok">CNPJ novo · dados da Receita</p><p className="font-semibold">{consult.info.name}</p><p className="text-xs text-muted">{[consult.info.tradeName, consult.info.city && `${consult.info.city}/${consult.info.uf}`, consult.info.status].filter(Boolean).join(" · ")}</p></div>
          : <p className="rounded-lg bg-sunk px-3 py-2 text-sm">CNPJ novo{consult ? ": a Receita não respondeu agora, digite o nome da empresa. O cadastro é completado depois." : "."} Vamos cadastrar o cliente ao criar a negociação.</p>
      )}
      {found && !found.lead.enriched && phase === "idle" && consult?.ok && consult.info && <p className="rounded-lg bg-sunk px-3 py-2 text-xs text-muted">Este cliente ainda não tinha consulta à Receita: {consult.info.status ?? "dados carregados"}. Ela é salva ao criar a negociação.</p>}
      {found && (
        <div className="space-y-3 rounded-xl border border-accent/40 p-4 text-sm">
          <div>
            <p className="font-semibold">{found.lead.company}</p>
            <p className="text-xs text-muted">{[found.lead.tradeName, found.lead.city && `${found.lead.city}/${found.lead.uf}`, found.lead.contactName, found.lead.sapCode && `SAP ${found.lead.sapCode}`, found.lead.status].filter(Boolean).join(" · ")}</p>
            {found.lead.phones.length > 0 && <p className="figure text-xs text-muted">{found.lead.phones.map(fmtPhone).join(" · ")}</p>}
            {found.lead.email && <p className="text-xs text-muted">{found.lead.email}</p>}
            {(found.lead.address || found.lead.neighborhood) && <p className="text-xs text-muted">{[found.lead.address, found.lead.neighborhood, found.lead.zip].filter(Boolean).join(" · ")}</p>}
          </div>
          {found.leftPortfolio && <p className="rounded-lg bg-danger/12 px-3 py-2 text-danger">Este cliente já comprou em mês anterior e saiu da carteira (vendas futuras). Não dá para abrir nova negociação.</p>}
          {found.openDeal && <p className="rounded-lg bg-warn/15 px-3 py-2 text-warn">Já existe negociação aberta{found.openDeal.sellerName ? ` com ${found.openDeal.sellerName}` : " (sem vendedor)"}. <Link href={`/negociacoes/${found.openDeal.id}`} className="font-semibold underline">Abrir</Link></p>}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted"><History size={13} aria-hidden /> Atendimento do SDR {found.deals > 0 && <span>· {found.deals} {found.deals === 1 ? "negociação anterior" : "negociações anteriores"}</span>}</p>
            {found.attendance.length ? (
              <ul className="space-y-1.5">{found.attendance.map((a, i) => <li key={i} className="text-xs"><b>{a.channel}</b> · {fmtDateTime(a.at)}{a.by ? ` · ${a.by}` : ""}{a.note && <span className="block whitespace-pre-wrap text-muted">{a.note}</span>}</li>)}</ul>
            ) : <p className="text-xs text-muted">Nenhum atendimento registrado ainda.</p>}
          </div>
        </div>
      )}

      {!blocked && (
        <>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {!found && <label className="block lg:col-span-2"><span className="mb-1 block text-muted">Nome da empresa (se a Receita não trouxer)</span><input className={inputCls} value={f.company} onChange={(e) => set("company", e.target.value)} /></label>}
            <label className="block"><span className="mb-1 block text-muted">Contato</span><input className={inputCls} value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">Telefone (com DDD)</span><input className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">E-mail</span><input className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
            <label className="block lg:col-span-2"><span className="mb-1 block text-muted">Endereço</span><input className={inputCls} value={f.street} onChange={(e) => set("street", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">Bairro</span><input className={inputCls} value={f.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">CEP</span><input className={inputCls} inputMode="numeric" value={f.zip} onChange={(e) => set("zip", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">Cidade / UF</span><span className="flex gap-2"><input className={inputCls} aria-label="Cidade" value={f.city} onChange={(e) => set("city", e.target.value)} /><input className={`${inputCls} !w-16 uppercase`} aria-label="UF" maxLength={2} value={f.uf} onChange={(e) => set("uf", e.target.value)} /></span></label>
            <label className="block"><span className="mb-1 block text-muted">Inscrição estadual</span><input className={inputCls} value={f.stateReg} onChange={(e) => set("stateReg", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">Frete</span><select className={inputCls} value={f.freight} onChange={(e) => set("freight", e.target.value)}><option value="">—</option><option>CIF</option><option>FOB</option><option>RED</option></select></label>
            <label className="block"><span className="mb-1 block text-muted">Código SAP</span><input className={inputCls} value={f.sapCode} onChange={(e) => set("sapCode", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">Condição de pagamento</span><select className={inputCls} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}><option value="">—</option>{[...new Set([...(f.paymentTerms ? [f.paymentTerms] : []), ...terms])].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-muted">Nº da cotação</span><input className={inputCls} value={f.quoteNumber} onChange={(e) => set("quoteNumber", e.target.value)} /></label>
            <div><span className="mb-1 block text-muted">Data da cotação</span><DateInput label="Data da cotação" value={f.quoteDate} onChange={(v) => set("quoteDate", v)} /></div>
            <label className="block"><span className="mb-1 block text-muted">Valor da cotação (R$)</span><input className={inputCls} inputMode="decimal" value={f.quoteValue} onChange={(e) => set("quoteValue", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-muted">Nº do pedido</span><input className={inputCls} value={f.orderNumber} onChange={(e) => set("orderNumber", e.target.value)} /></label>
            <label className="flex items-center gap-2 pt-6"><input type="checkbox" checked={f.isReactivation} onChange={(e) => set("isReactivation", e.target.checked)} /> Cliente reativado</label>
          </div>
          <textarea className={`${inputCls} min-h-16`} placeholder="Anotação (de onde veio, o que combinaram…)" value={f.note} onChange={(e) => set("note", e.target.value)} />
          {items.length > 0 && <p className="text-xs text-muted">{items.length} itens lidos do PDF ({fmtBRL(items.reduce((a, i) => a + (i.totalCents ?? 0), 0))} em produtos) serão salvos junto.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ColorPicker value={color} onChange={setColor} disabled={busy} />
            <button type="button" className={btnPrimary} disabled={busy || f.cnpj.replace(/\D/g, "").length < 14} onClick={create}><Check size={16} aria-hidden /> Criar negociação</button>
          </div>
        </>
      )}
    </section>
    </div>
  );
  return (
    <>
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}><Plus size={16} aria-hidden /> Nova negociação</button>
      {open && mounted && createPortal(panel, document.body)}
    </>
  );
}
