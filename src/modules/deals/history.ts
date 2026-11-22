import { and, desc, eq } from "drizzle-orm";
import { db, interactions, leads, sellerShuffles, tags, users } from "@/db";
import { getLeadCommercial, type LeadCommercial } from "./lead-commercial";

export type ClientHistory = {
  lead: { id: number; company: string; tradeName: string | null; city: string | null; uf: string | null; contactName: string | null; phones: string[]; email: string | null; sapCode: string | null; kind: "prospect" | "inativo"; salesforceUrl: string | null; eoxUrl: string | null };
  commercial: LeadCommercial;
  interactions: { at: string; by: string | null; channel: string; note: string | null }[];
  shuffles: { at: string; by: string | null; outcome: string | null; note: string | null }[];
  /** Vendedores que já tiveram este cliente (com negociação aberta ou encerrada). */
  sellers: string[];
  open: { id: number; sellerName: string | null } | null;
  totals: { billedCents: number; billedCount: number; quotes: number; lost: number; deals: number };
};

/** Tudo que o sistema sabe de um cliente: negociações, cotações, faturamentos, andamentos, visitas, atendimentos do SDR e passagens no Shuffler Vendas. */
export async function getClientHistory(leadId: number): Promise<ClientHistory | null> {
  const [l] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!l) return null;
  const [commercial, att, sh] = await Promise.all([
    getLeadCommercial(leadId),
    db.select({ at: interactions.at, by: users.name, channel: interactions.channel, label: tags.label, note: interactions.note }).from(interactions)
      .leftJoin(users, eq(users.id, interactions.userId)).leftJoin(tags, and(eq(tags.groupKey, "meio"), eq(tags.key, interactions.channel)))
      .where(and(eq(interactions.leadId, leadId), eq(interactions.isTest, false))).orderBy(desc(interactions.at)).limit(15),
    db.select({ at: sellerShuffles.shownAt, by: users.name, outcome: sellerShuffles.outcome, note: sellerShuffles.note }).from(sellerShuffles)
      .leftJoin(users, eq(users.id, sellerShuffles.userId)).where(eq(sellerShuffles.leadId, leadId)).orderBy(desc(sellerShuffles.id)).limit(10),
  ]);
  const won = commercial.deals.filter((d) => d.stage === "ganho");
  const openDeal = commercial.deals.find((d) => d.stage !== "ganho" && d.stage !== "perdido");
  return {
    lead: { id: l.id, company: l.company, tradeName: l.tradeName, city: l.city, uf: l.uf, contactName: l.contactName, phones: l.phones, email: l.email, sapCode: l.sapCode, kind: l.kind, salesforceUrl: l.salesforceUrl, eoxUrl: l.eoxUrl },
    commercial,
    interactions: att.map((a) => ({ at: a.at.toISOString(), by: a.by, channel: a.label ?? a.channel, note: a.note })),
    shuffles: sh.map((s) => ({ at: s.at.toISOString(), by: s.by, outcome: s.outcome, note: s.note })),
    sellers: [...new Set(commercial.deals.map((d) => d.sellerName).filter((x): x is string => !!x))],
    open: openDeal ? { id: openDeal.id, sellerName: openDeal.sellerName } : null,
    totals: { billedCents: won.reduce((a, d) => a + (d.mainCents ?? 0), 0), billedCount: won.length, quotes: commercial.quotes.length, lost: commercial.deals.filter((d) => d.stage === "perdido").length, deals: commercial.deals.length },
  };
}

/** O cliente está na carteira de algum vendedor? (tem ou já teve negociação com vendedor) */
export const inSellerPortfolio = (h: ClientHistory) => h.sellers.length > 0;
