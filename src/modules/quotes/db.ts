import { desc, eq, sql } from "drizzle-orm";
import { dealQuotes, deals, db, paymentTerms, products, type Db } from "@/db";
import { settingValue } from "@/modules/settings/get";
import type { DbOrTx } from "@/modules/audit/log";
import type { QuoteItem } from "./parse";

type Tx = DbOrTx | Db;

/** Imposto extra descontado do líquido (PIS/COFINS), em %. Padrão 9,25; o admin muda em Admin → Vendas. */
export const DEFAULT_EXTRA_TAX_PCT = 9.25;
export async function getExtraTaxPct(): Promise<number> {
  const v = Number(await settingValue("net_extra_tax_pct"));
  return Number.isFinite(v) && v >= 0 && v < 100 ? v : DEFAULT_EXTRA_TAX_PCT;
}

/** Totais de uma cotação a partir dos itens. O preço unitário já traz o ICMS; o IPI vem por fora.
 *  Sem impostos = (total − IPI − ICMS) menos o imposto extra (PIS/COFINS) sobre essa base. */
export function totalsOf(items: QuoteItem[], freightCents: number, extraTaxPct = 0) {
  const productsCents = items.reduce((a, i) => a + (i.totalCents ?? 0), 0);
  const ipiCents = items.reduce((a, i) => a + (i.ipiCents ?? 0), 0);
  const icmsCents = items.reduce((a, i) => a + (i.icmsCents ?? 0), 0);
  const totalCents = productsCents + ipiCents + freightCents;
  const netCents = Math.round((totalCents - ipiCents - icmsCents) * (1 - extraTaxPct / 100));
  return { productsCents, ipiCents, icmsCents, totalCents, netCents };
}

/** Recalcula o total do item (quantidade × preço unitário) e o IPI/ICMS proporcionais quando a quantidade mudou. */
export function normalizeItem(i: QuoteItem, prevQty?: number): QuoteItem {
  const total = i.unitCents != null ? Math.round(i.qty * i.unitCents) : i.totalCents;
  const k = prevQty && prevQty > 0 && prevQty !== i.qty ? i.qty / prevQty : 1;
  return { ...i, totalCents: total, ipiCents: i.ipiCents != null ? Math.round(i.ipiCents * k) : null, icmsCents: i.icmsCents != null ? Math.round(i.icmsCents * k) : null };
}

/** Cada item visto entra (ou atualiza) o catálogo de produtos. */
export async function upsertProducts(tx: Tx, items: QuoteItem[]) {
  for (const i of items) {
    if (!i.productCode) continue;
    await tx.insert(products).values({ code: i.productCode, description: i.description, kind: i.kind, unit: i.unit, lastUnitCents: i.unitCents })
      .onConflictDoUpdate({ target: products.code, set: { description: i.description, kind: i.kind, unit: i.unit, lastUnitCents: i.unitCents, seenCount: sql`${products.seenCount} + 1`, updatedAt: new Date() } });
  }
}

export const normTerm = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 120);

/** Condição de pagamento lida de um PDF: entra na lista (se ainda não estiver). */
export async function upsertPaymentTerm(tx: Tx, name: string | null | undefined) {
  const n = name ? normTerm(name) : "";
  if (n) await tx.insert(paymentTerms).values({ name: n }).onConflictDoNothing();
  return n || null;
}

/** A negociação espelha a última cotação (valor, número e data), que é o que os avisos e as metas usam. */
export async function syncDealFromQuotes(tx: Tx, dealId: number) {
  const [q] = await tx.select().from(dealQuotes).where(eq(dealQuotes.dealId, dealId)).orderBy(desc(dealQuotes.id)).limit(1);
  await tx.update(deals).set({ valueCents: q?.totalCents ?? null, netValueCents: q?.netCents ?? q?.totalCents ?? null, weightKg: q?.weightKg ?? null, quoteNumber: q?.number ?? null, quoteDate: q?.quoteDate ?? null, updatedAt: new Date() }).where(eq(deals.id, dealId));
}
