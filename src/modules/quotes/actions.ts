"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSettings } from "@/modules/settings/get";
import { ALERT_RULES, parseMoneyToCents } from "@/config/deals";
import { dealEvents, dealQuoteItems, dealQuotes, deals, paymentTerms, products } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { loadDeal } from "@/modules/deals/access";
import type { ActionResult } from "@/modules/leads/actions";
import { getExtraTaxPct, normalizeItem, normTerm, syncDealFromQuotes, totalsOf, upsertPaymentTerm, upsertProducts } from "./db";

const fail = (message: string): ActionResult => ({ ok: false, message });
const refresh = (id: number) => { for (const p of ["/negociacoes", `/negociacoes/${id}`, "/painel", "/metas", "/metas-vendas", "/historico", "/historico-vendas"]) revalidatePath(p); };

const cents = z.number().int().nullable();
const itemSchema = z.object({
  seq: z.number().int(), productCode: z.string().trim().min(1).max(40), clientRef: z.string().max(120).nullable(), description: z.string().trim().min(1).max(300), kind: z.string().max(40).nullable(),
  qty: z.number().min(0).max(1e9), packQty: z.number().min(0).max(1e9).nullable(), unit: z.string().max(8).nullable(),
  icmsCents: cents, ipiCents: cents, unitCents: cents, totalCents: cents,
});
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type QuoteInput = {
  number: string; date: string; freight: string; paymentTerms: string; validityDays: number | null; note: string;
  /** Frete negociado (R$), usado no total. */ freightValue: string;
  /** Sem itens: valor total digitado (R$). */ totalValue: string;
  /** Valor sem impostos informado pelo vendedor (vem corrigido do Salesforce). Vazio = calculado. */ netValue?: string;
  /** Link da cotação no Salesforce. */ link?: string;
  /** Peso total (kg), ex.: "423,94". Vazio = sem peso. */ weight?: string;
  items: z.infer<typeof itemSchema>[]; followupDays?: number;
};

/** Cria (quoteId null) ou edita uma cotação. Cada cotação é única na negociação (pelo número) e guarda os próprios itens. */
export async function saveQuoteAction(dealId: number, quoteId: number | null, input: QuoteInput): Promise<ActionResult> {
  const r = await loadDeal(dealId);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (!quoteId && (deal.stage === "ganho" || deal.stage === "perdido")) return fail("Esta negociação já foi encerrada.");
  const items = z.array(itemSchema).max(300).safeParse(input.items);
  if (!items.success) return fail("Confira os itens: código, descrição e quantidade são obrigatórios.");
  const prev = quoteId ? await db.select().from(dealQuoteItems).where(eq(dealQuoteItems.quoteId, quoteId)) : [];
  const prevQty = new Map(prev.map((p) => [p.productCode, Number(p.qty)]));
  const list = items.data.map((i, n) => ({ ...normalizeItem(i, prevQty.get(i.productCode)), seq: (n + 1) * 10 }));
  const number = input.number.trim().slice(0, 40) || null;
  const date = input.date.trim();
  if (date && !isoDate.safeParse(date).success) return fail("Data da cotação inválida.");
  const f = input.freight.toUpperCase();
  if (f && !["CIF", "FOB", "RED"].includes(f)) return fail("Frete deve ser CIF, FOB ou RED.");
  const freightCents = input.freightValue.trim() ? parseMoneyToCents(input.freightValue) : 0;
  if (freightCents === null) return fail("Frete negociado inválido.");
  let t = { productsCents: null as number | null, ipiCents: null as number | null, icmsCents: null as number | null, netCents: null as number | null, totalCents: null as number | null };
  if (list.length) t = totalsOf(list, freightCents, await getExtraTaxPct());
  else {
    const v = parseMoneyToCents(input.totalValue);
    if (v === null || v <= 0) return fail("Informe o valor da cotação (ex.: 12.500,00) ou adicione os itens.");
    t.totalCents = v; t.netCents = v;
  }
  if (input.netValue?.trim()) {
    const n = parseMoneyToCents(input.netValue);
    if (n === null || n < 0) return fail("Valor sem impostos inválido.");
    t.netCents = n;
  }
  const link = (input.link ?? "").trim();
  if (link && !/^https?:\/\/\S+$/i.test(link)) return fail("O link da cotação precisa começar com http:// ou https://.");
  const term = input.paymentTerms.trim() ? normTerm(input.paymentTerms) : null;
  if (term) {
    const [ok] = await db.select({ id: paymentTerms.id }).from(paymentTerms).where(and(eq(paymentTerms.name, term), eq(paymentTerms.active, true)));
    if (!ok) return fail("Condição de pagamento fora da lista. Ela entra sozinha quando vem de um PDF; ou peça ao Adm para incluir.");
  }
  if (number) {
    const dup = await db.select({ id: dealQuotes.id }).from(dealQuotes).where(and(eq(dealQuotes.dealId, dealId), eq(dealQuotes.number, number), quoteId ? ne(dealQuotes.id, quoteId) : undefined));
    if (dup.length) return fail(`Já existe a cotação ${number} nesta negociação. Cada cotação é única: edite a existente.`);
  }
  const days = input.followupDays && Number.isInteger(input.followupDays) && input.followupDays >= 1 && input.followupDays <= 30 ? input.followupDays : (await getSettings()).deal_followup_days;
  const wRaw = (input.weight ?? "").trim();
  const weightKg = wRaw ? Number(wRaw.replace(/\./g, "").replace(",", ".")) : null;
  if (wRaw && (weightKg === null || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 1e7)) return fail("Peso inválido. Exemplo: 423,94.");
  const values = { weightKg, number, quoteDate: date || null, totalCents: t.totalCents, productsCents: t.productsCents, ipiCents: t.ipiCents, icmsCents: t.icmsCents, netCents: t.netCents, freightCents: list.length ? freightCents : null, freight: (f || null) as "CIF" | "FOB" | "RED" | null, paymentTerms: term, validityDays: input.validityDays && input.validityDays > 0 ? Math.min(input.validityDays, 365) : null, note: input.note.trim().slice(0, 2000) || null, link: link.slice(0, 500) || null };
  const id = await db.transaction(async (tx) => {
    let qid = quoteId;
    if (qid) {
      const [old] = await tx.select().from(dealQuotes).where(and(eq(dealQuotes.id, qid), eq(dealQuotes.dealId, dealId)));
      if (!old) throw new Error("Cotação não encontrada.");
      await tx.update(dealQuotes).set({ ...values, updatedAt: new Date() }).where(eq(dealQuotes.id, qid));
      await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "editou cotação", field: `Cotação ${old.number ?? old.id}`, oldValue: old.totalCents, newValue: t.totalCents, meta: { negociacao: dealId, itens: list.length } });
    } else {
      [{ id: qid }] = await tx.insert(dealQuotes).values({ dealId, createdBy: me.id, ...values }).returning({ id: dealQuotes.id });
      const stage = deal.stage === "negociacao" ? "negociacao" : "cotacao";
      await tx.update(deals).set({ stage, quoteSentAt: new Date(), lastContactAt: new Date(), nextActionAt: new Date(Date.now() + days * 86400_000), nextActionNote: "Cobrar retorno da cotação", freight: values.freight ?? deal.freight, paymentTerms: term ?? deal.paymentTerms }).where(eq(deals.id, dealId));
      await tx.insert(dealEvents).values({ dealId, userId: me.id, kind: "cotacao", valueCents: t.totalCents, note: [number ? `Cotação ${number}` : null, values.note].filter(Boolean).join(" · ") || null });
      await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "enviou cotação", field: `Cotação ${number ?? qid}`, newValue: t.totalCents, meta: { negociacao: dealId, itens: list.length } });
    }
    await tx.delete(dealQuoteItems).where(eq(dealQuoteItems.quoteId, qid));
    if (list.length) {
      await tx.insert(dealQuoteItems).values(list.map((i) => ({ ...i, dealId, quoteId: qid, quoteNumber: number })));
      await upsertProducts(tx, list);
    }
    await upsertPaymentTerm(tx, term);
    await syncDealFromQuotes(tx, dealId);
    return qid;
  }).catch((e) => (e instanceof Error && e.message === "Cotação não encontrada." ? null : Promise.reject(e)));
  if (!id) return fail("Cotação não encontrada.");
  refresh(dealId);
  return { ok: true, message: quoteId ? "Cotação atualizada." : `Cotação registrada. Aviso de cobrança em ${days} ${days === 1 ? "dia" : "dias"}.` };
}

export async function deleteQuoteAction(dealId: number, quoteId: number): Promise<ActionResult> {
  const r = await loadDeal(dealId);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  const [q] = await db.select().from(dealQuotes).where(and(eq(dealQuotes.id, quoteId), eq(dealQuotes.dealId, dealId)));
  if (!q) return fail("Cotação não encontrada.");
  const n = await db.select({ c: sql<number>`count(*)::int` }).from(dealQuoteItems).where(eq(dealQuoteItems.quoteId, quoteId));
  await db.transaction(async (tx) => {
    await tx.delete(dealQuotes).where(eq(dealQuotes.id, quoteId));
    await syncDealFromQuotes(tx, dealId);
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "apagou cotação", field: `Cotação ${q.number ?? q.id}`, oldValue: q.totalCents, meta: { negociacao: dealId, itens: n[0]?.c ?? 0, numero: q.number, total: q.totalCents } });
  });
  refresh(dealId);
  return { ok: true, message: "Cotação apagada." };
}

/** Procura um produto do catálogo pelo código (para preencher a descrição e o preço ao digitar). */
export async function lookupProductAction(code: string): Promise<{ description: string; kind: string | null; unit: string | null; lastUnitCents: number | null; weightKg: number | null } | null> {
  await requireUser();
  const c = code.trim();
  if (!c) return null;
  const [p] = await db.select().from(products).where(sql`${products.code} = ${c} or ${c} = any(${products.altCodes})`).orderBy(sql`(${products.code} = ${c}) desc`).limit(1);
  return p ? { description: p.description, kind: p.kind, unit: p.unit, lastUnitCents: p.lastUnitCents, weightKg: p.weightKg } : null;
}
