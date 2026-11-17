import { desc, eq, sql } from "drizzle-orm";
import { dealQuotes, deals, paymentTerms, products, type Db } from "@/db";
import type { DbOrTx } from "@/modules/audit/log";
import type { QuoteItem } from "./parse";

type Tx = DbOrTx | Db;

/** Totais de uma cotação a partir dos itens: produtos (sem IPI), IPI e total com IPI + frete. */
export function totalsOf(items: QuoteItem[], freightCents: number) {
  const productsCents = items.reduce((a, i) => a + (i.totalCents ?? 0), 0);
  const ipiCents = items.reduce((a, i) => a + (i.ipiCents ?? 0), 0);
  return { productsCents, ipiCents, totalCents: productsCents + ipiCents + freightCents };
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
  await tx.update(deals).set({ valueCents: q?.totalCents ?? null, quoteNumber: q?.number ?? null, quoteDate: q?.quoteDate ?? null, updatedAt: new Date() }).where(eq(deals.id, dealId));
}
