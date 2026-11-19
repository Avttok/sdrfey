import { eq, inArray, sql } from "drizzle-orm";
import { db, dealEvents, dealQuotes, deals, leadChannels, leads, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { leftPortfolio } from "@/modules/deals/portfolio";
import { normTerm, syncDealFromQuotes, upsertPaymentTerm } from "@/modules/quotes/db";
import type { DealDraft } from "./deals-parse";

export type SkipReason = "aberta_propria" | "aberta_outro" | "fora_carteira" | "pedido_repetido" | "cotacao_repetida" | "perdida_repetida" | "venda_repetida";
export type Plan = { create: DealDraft[]; skipped: { line: number; cnpj: string; reason: SkipReason; detail?: string }[]; newLeads: number; existingLeads: number; /** Clientes que entram e já estão (ou já estiveram) na carteira de algum vendedor. */ inPortfolio: { leadId: number; cnpj: string; company: string; sellers: string[]; line: number }[] };

export const SKIP_LABEL: Record<SkipReason, string> = {
  aberta_propria: "Você já tem uma negociação aberta com esse cliente",
  aberta_outro: "Outro vendedor já está com esse cliente",
  fora_carteira: "Cliente já comprou em mês anterior (saiu da carteira)",
  pedido_repetido: "Esse pedido já está no sistema",
  cotacao_repetida: "Essa cotação já está no sistema",
  perdida_repetida: "Essa negociação perdida já está no sistema",
  venda_repetida: "Essa venda (mesma data e valor) já está no sistema",
};

/** Decide, linha a linha, o que entra e o que já existe. Nada é gravado aqui. */
export async function planDealImport(drafts: DealDraft[], sellerId: number): Promise<Plan> {
  const cnpjs = [...new Set(drafts.map((d) => d.cnpj))];
  const leadRows = cnpjs.length ? await db.select({ id: leads.id, cnpj: leads.cnpj, company: leads.company }).from(leads).where(inArray(leads.cnpj, cnpjs)) : [];
  const leadId = new Map(leadRows.map((l) => [l.cnpj, l.id]));
  const ids = leadRows.map((l) => l.id);
  const [existing, quotes, gone] = ids.length ? await Promise.all([
    db.select().from(deals).where(inArray(deals.leadId, ids)),
    db.select({ dealId: dealQuotes.dealId, number: dealQuotes.number }).from(dealQuotes).innerJoin(deals, eq(deals.id, dealQuotes.dealId)).where(inArray(deals.leadId, ids)),
    db.execute<{ id: number; x: boolean }>(sql`select l.id, ${leftPortfolio(sql`l.id`)} as x from leads l where l.id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`),
  ]) : [[], [], []];
  const goneSet = new Set((gone as { id: number; x: boolean }[]).filter((g) => g.x).map((g) => g.id));
  const dealLead = new Map(existing.map((d) => [d.id, d.leadId]));
  const quoteKeys = new Set(quotes.map((q) => `${dealLead.get(q.dealId)}|${q.number}`));
  const plan: Plan = { create: [], skipped: [], newLeads: 0, existingLeads: 0, inPortfolio: [] };
  const sellerIds = [...new Set(existing.map((d) => d.sellerId).filter((x): x is number => !!x))];
  const sellerName = new Map((sellerIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, sellerIds)) : []).map((u) => [u.id, u.name]));
  const company = new Map(leadRows.map((l) => [l.id, l.company]));
  const warned = new Set<number>();
  const newSet = new Set<string>();
  for (const d of drafts) {
    const lid = leadId.get(d.cnpj);
    const skip = (reason: SkipReason, detail?: string) => plan.skipped.push({ line: d.line, cnpj: d.cnpj, reason, detail });
    const closed = d.stage === "ganho" || d.stage === "perdido";
    if (lid) {
      const mine = existing.filter((x) => x.leadId === lid);
      if (!closed) {
        const open = mine.find((x) => x.stage !== "ganho" && x.stage !== "perdido");
        if (open) { skip(open.sellerId === sellerId ? "aberta_propria" : "aberta_outro"); continue; }
        if (goneSet.has(lid)) { skip("fora_carteira"); continue; }
      } else {
        if (d.orderNumber && mine.some((x) => x.orderNumber === d.orderNumber)) { skip("pedido_repetido", d.orderNumber); continue; }
        if (d.quoteNumber && (quoteKeys.has(`${lid}|${d.quoteNumber}`) || mine.some((x) => x.quoteNumber === d.quoteNumber && x.stage === d.stage))) { skip("cotacao_repetida", d.quoteNumber); continue; }
        if (d.stage === "ganho" && mine.some((x) => x.stage === "ganho" && x.closedOn === d.closedOn && x.closedValueCents === (d.closedCents ?? d.quoteCents) && (x.orderNumber ?? "") === (d.orderNumber ?? ""))) { skip("venda_repetida"); continue; }
        if (d.stage === "perdido" && mine.some((x) => x.stage === "perdido" && (x.lostReason ?? "") === (d.lostReason ?? "") && x.closedOn === d.closedOn)) { skip("perdida_repetida"); continue; }
      } 
      if (!closed && d.quoteNumber && quoteKeys.has(`${lid}|${d.quoteNumber}`)) { skip("cotacao_repetida", d.quoteNumber); continue; }
      plan.existingLeads++;
      const sellers = [...new Set(mine.map((x) => x.sellerId).filter((x): x is number => !!x).map((x) => sellerName.get(x) ?? "vendedor"))];
      if (sellers.length && !warned.has(lid)) { warned.add(lid); plan.inPortfolio.push({ leadId: lid, cnpj: d.cnpj, company: company.get(lid) ?? d.cnpj, sellers, line: d.line }); }
    } else if (!newSet.has(d.cnpj)) { newSet.add(d.cnpj); plan.newLeads++; }
    plan.create.push(d);
  }
  return plan;
}

const noon = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

/** Grava o plano. Cada linha é isolada: se uma falhar (ex.: corrida com outro vendedor), as outras seguem. */
export async function applyDealImport(plan: Plan, o: { sellerId: number; userId: number; fileName: string }) {
  let created = 0, raced = 0, leadsCreated = 0;
  for (const d of plan.create) {
    try {
      await db.transaction(async (tx) => {
        let [lead] = await tx.select().from(leads).where(eq(leads.cnpj, d.cnpj));
        if (!lead) {
          [lead] = await tx.insert(leads).values({ cnpj: d.cnpj, company: d.company ?? `CNPJ ${d.cnpj}`, contactName: d.contact, phones: d.phones, email: d.email, city: d.city, uf: d.uf, sapCode: d.sapCode, source: "vendedor" }).returning();
          leadsCreated++;
        } else {
          const fill: Partial<typeof leads.$inferInsert> = {};
          if (d.contact && !lead.contactName) fill.contactName = d.contact;
          if (d.email && !lead.email) fill.email = d.email;
          if (d.city && !lead.city) fill.city = d.city;
          if (d.uf && !lead.uf) fill.uf = d.uf;
          if (d.sapCode && !lead.sapCode) fill.sapCode = d.sapCode;
          const newPhones = d.phones.filter((p) => !lead.phones.includes(p));
          if (newPhones.length) fill.phones = [...lead.phones, ...newPhones];
          if (Object.keys(fill).length) await tx.update(leads).set({ ...fill, updatedAt: new Date() }).where(eq(leads.id, lead.id));
        }
        for (const p of d.phones) await tx.insert(leadChannels).values({ leadId: lead.id, kind: "phone", value: p, origin: "import" }).onConflictDoNothing();
        if (d.email) await tx.insert(leadChannels).values({ leadId: lead.id, kind: "email", value: d.email, origin: "import" }).onConflictDoNothing();

        const closedAt = d.stage === "ganho" || d.stage === "perdido" ? (d.closedOn ? noon(d.closedOn) : new Date()) : null;
        const term = d.paymentTerms ? await upsertPaymentTerm(tx, normTerm(d.paymentTerms)) : null;
        const [deal] = await tx.insert(deals).values({
          leadId: lead.id, sellerId: o.sellerId, stage: d.stage, handoffNote: d.note, claimedAt: new Date(), lastContactAt: new Date(),
          freight: d.freight, sapCode: d.sapCode, orderNumber: d.orderNumber, quoteNumber: d.quoteNumber, quoteDate: d.quoteDate, paymentTerms: term,
          closedOn: d.stage === "ganho" ? d.closedOn : null, closedAt, closedValueCents: d.stage === "ganho" ? d.closedCents ?? d.quoteCents : null,
          realValueCents: d.stage === "ganho" ? d.realCents : null, isReactivation: d.reactivation, lostReason: d.stage === "perdido" ? d.lostReason : null,
          quoteSentAt: d.quoteCents ? (d.quoteDate ? noon(d.quoteDate) : new Date()) : null,
          nextActionAt: closedAt ? null : d.nextAt ? noon(d.nextAt) : null, nextActionNote: closedAt || !d.nextAt ? null : "Retomar contato", isTest: lead.isTest,
        }).returning({ id: deals.id });
        await tx.insert(dealEvents).values({ dealId: deal.id, userId: o.userId, kind: "criado", note: `Importado da planilha (${o.fileName})` });
        if (d.quoteCents || d.quoteNumber) {
          await tx.insert(dealQuotes).values({ dealId: deal.id, createdBy: o.userId, number: d.quoteNumber, quoteDate: d.quoteDate, totalCents: d.quoteCents ?? d.closedCents, netCents: d.netCents ?? d.quoteCents ?? d.closedCents, freight: d.freight, paymentTerms: term });
          await tx.insert(dealEvents).values({ dealId: deal.id, userId: o.userId, kind: "cotacao", valueCents: d.quoteCents, note: d.quoteNumber ? `Cotação ${d.quoteNumber}` : null });
          await syncDealFromQuotes(tx, deal.id);
        }
        if (d.stage === "ganho") await tx.insert(dealEvents).values({ dealId: deal.id, userId: o.userId, kind: "ganho", valueCents: d.closedCents ?? d.quoteCents, note: d.orderNumber ? `Pedido ${d.orderNumber}` : null });
        if (d.stage === "perdido") await tx.insert(dealEvents).values({ dealId: deal.id, userId: o.userId, kind: "perdido", note: d.lostReason });
        created++;
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") raced++; else throw e;
    }
  }
  await logAudit(db, { userId: o.userId, entity: "import", action: "importou negociações", field: o.fileName, newValue: `${created} negociações, ${leadsCreated} leads novos`, meta: { vendedor: o.sellerId, ignoradas: plan.skipped.length + raced } });
  return { created, leadsCreated, raced };
}
