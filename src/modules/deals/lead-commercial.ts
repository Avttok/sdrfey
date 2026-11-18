import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, dealEvents, dealQuotes, deals, users, visits, type DealStage } from "@/db";

export type CommDeal = { id: number; stage: DealStage; sellerName: string | null; mainCents: number | null; orderNumber: string | null; closedOn: string | null; createdAt: string; weightKg: number | null };
export type CommQuote = { id: number; dealId: number; number: string | null; quoteDate: string | null; totalCents: number | null; netCents: number | null; weightKg: number | null };
export type CommEvent = { id: number; dealId: number; kind: string; note: string | null; valueCents: number | null; at: string; by: string | null };
export type CommVisit = { id: number; code: string; status: "pendente" | "confirmada" | "realizada" | "cancelada"; visitDate: string | null; link: string | null; kind: "rep" | "seller"; repName: string | null; sellerName: string | null; at: string; by: string | null };
export type LeadCommercial = { deals: CommDeal[]; quotes: CommQuote[]; events: CommEvent[]; visits: CommVisit[] };

/** Tudo do lado comercial de um cliente: negociações, cotações, vendas, andamentos registrados e visitas. */
export async function getLeadCommercial(leadId: number, onlyDealIds?: number[]): Promise<LeadCommercial> {
  const dealRows = await db.select({ d: deals, seller: users.name }).from(deals).leftJoin(users, eq(users.id, deals.sellerId))
    .where(and(eq(deals.leadId, leadId), onlyDealIds ? inArray(deals.id, onlyDealIds.length ? onlyDealIds : [-1]) : undefined)).orderBy(desc(deals.createdAt));
  const ids = dealRows.map((r) => r.d.id);
  const [quotes, events, visitRows] = await Promise.all([
    ids.length ? db.select().from(dealQuotes).where(inArray(dealQuotes.dealId, ids)).orderBy(desc(dealQuotes.id)) : Promise.resolve([]),
    ids.length ? db.select({ e: dealEvents, by: users.name }).from(dealEvents).leftJoin(users, eq(users.id, dealEvents.userId)).where(inArray(dealEvents.dealId, ids)).orderBy(desc(dealEvents.at), desc(dealEvents.id)).limit(300) : Promise.resolve([]),
    db.select({ v: visits, by: users.name, seller: users.name }).from(visits).leftJoin(users, eq(users.id, visits.userId)).where(eq(visits.leadId, leadId)).orderBy(desc(visits.id)),
  ]);
  const sellerNames = new Map<number, string>();
  const sids = [...new Set(visitRows.map((r) => r.v.sellerId).filter((x): x is number => !!x))];
  if (sids.length) for (const u of await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, sids))) sellerNames.set(u.id, u.name);
  return {
    deals: dealRows.map(({ d, seller }) => ({ id: d.id, stage: d.stage, sellerName: seller, mainCents: d.realValueCents ?? d.closedValueCents ?? d.netValueCents ?? d.valueCents, orderNumber: d.orderNumber, closedOn: d.closedOn, createdAt: d.createdAt.toISOString(), weightKg: d.weightKg })),
    quotes: quotes.map((q) => ({ id: q.id, dealId: q.dealId, number: q.number, quoteDate: q.quoteDate, totalCents: q.totalCents, netCents: q.netCents, weightKg: q.weightKg })),
    events: events.map(({ e, by }) => ({ id: e.id, dealId: e.dealId, kind: e.kind, note: e.note, valueCents: e.valueCents, at: e.at.toISOString(), by })),
    visits: visitRows.map(({ v, by }) => ({ id: v.id, code: v.code, status: v.canceledAt ? "cancelada" as const : v.status, visitDate: v.visitDate, link: v.link, kind: v.kind, repName: v.repName, sellerName: v.sellerId ? sellerNames.get(v.sellerId) ?? null : null, at: v.createdAt.toISOString(), by })),
  };
}
