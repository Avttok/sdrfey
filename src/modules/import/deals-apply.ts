import { eq, inArray, sql } from "drizzle-orm";
import { db, dealEvents, dealQuoteItems, dealQuotes, deals, leadChannels, leads, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { leftPortfolio } from "@/modules/deals/portfolio";
import { getExtraTaxPct, icmsPctFor, normalizeItem, normTerm, syncDealFromQuotes, totalsOf, upsertPaymentTerm, upsertProducts, withIcmsPct } from "@/modules/quotes/db";
import type { DealDraft } from "./deals-parse";

export type SkipReason = "aberta_propria" | "aberta_outro" | "fora_carteira" | "pedido_repetido" | "cotacao_repetida" | "perdida_repetida" | "venda_repetida";
export type DupPolicy = "skip" | "fill" | "overwrite";
export type Match = { draft: DealDraft; dealId: number };
export type Plan = { create: DealDraft[]; /** Linhas que já existem no sistema (negociação encontrada): dependendo da escolha, completam ou substituem. */ matches: Match[]; skipped: { line: number; cnpj: string; reason: SkipReason; detail?: string }[]; newLeads: number; existingLeads: number; /** Clientes que entram e já estão (ou já estiveram) na carteira de algum vendedor. */ inPortfolio: { leadId: number; cnpj: string; company: string; sellers: string[]; line: number }[] };

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
  const quoteDeal = new Map(quotes.map((q) => [`${dealLead.get(q.dealId)}|${q.number}`, q.dealId]));
  const plan: Plan = { create: [], matches: [], skipped: [], newLeads: 0, existingLeads: 0, inPortfolio: [] };
  const sellerIds = [...new Set(existing.map((d) => d.sellerId).filter((x): x is number => !!x))];
  const sellerName = new Map((sellerIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, sellerIds)) : []).map((u) => [u.id, u.name]));
  const company = new Map(leadRows.map((l) => [l.id, l.company]));
  const warned = new Set<number>();
  const newSet = new Set<string>();
  for (const d of drafts) {
    const lid = leadId.get(d.cnpj);
    const skip = (reason: SkipReason, detail?: string, dealId?: number) => { plan.skipped.push({ line: d.line, cnpj: d.cnpj, reason, detail }); if (dealId) plan.matches.push({ draft: d, dealId }); };
    const closed = d.stage === "ganho" || d.stage === "perdido";
    if (lid) {
      const mine = existing.filter((x) => x.leadId === lid);
      if (!closed) {
        const open = mine.find((x) => x.stage !== "ganho" && x.stage !== "perdido");
        if (open) { skip(open.sellerId === sellerId ? "aberta_propria" : "aberta_outro", undefined, open.sellerId === sellerId ? open.id : undefined); continue; }
        if (goneSet.has(lid)) { skip("fora_carteira"); continue; }
      } else {
        const po = d.orderNumber ? mine.find((x) => x.orderNumber === d.orderNumber) : undefined;
        if (po) { skip("pedido_repetido", d.orderNumber ?? undefined, po.id); continue; }
        const pq = d.quoteNumber ? (mine.find((x) => x.quoteNumber === d.quoteNumber && x.stage === d.stage)?.id ?? quoteDeal.get(`${lid}|${d.quoteNumber}`)) : undefined;
        if (pq) { skip("cotacao_repetida", d.quoteNumber ?? undefined, pq); continue; }
        const pv = d.stage === "ganho" ? mine.find((x) => x.stage === "ganho" && x.closedOn === d.closedOn && x.closedValueCents === (d.closedCents ?? d.quoteCents) && (x.orderNumber ?? "") === (d.orderNumber ?? "")) : undefined;
        if (pv) { skip("venda_repetida", undefined, pv.id); continue; }
        const pp = d.stage === "perdido" ? mine.find((x) => x.stage === "perdido" && (x.lostReason ?? "") === (d.lostReason ?? "") && x.closedOn === d.closedOn) : undefined;
        if (pp) { skip("perdida_repetida", undefined, pp.id); continue; }
      } 
      if (!closed && d.quoteNumber && quoteKeys.has(`${lid}|${d.quoteNumber}`)) { skip("cotacao_repetida", d.quoteNumber, quoteDeal.get(`${lid}|${d.quoteNumber}`)); continue; }
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
          nextActionAt: closedAt ? null : d.nextAt ? noon(d.nextAt) : null, nextActionNote: closedAt || !d.nextAt ? null : "Retomar contato", isTest: lead.isTest, importPending: !lead.isTest && !lead.enrichTriedAt && !lead.enrichedAt,
        }).returning({ id: deals.id });
        await tx.insert(dealEvents).values({ dealId: deal.id, userId: o.userId, kind: "criado", note: `Importado da planilha (${o.fileName})` });
        if (d.quoteCents || d.quoteNumber) {
          const [qrow] = await tx.insert(dealQuotes).values({ dealId: deal.id, createdBy: o.userId, number: d.quoteNumber, quoteDate: d.quoteDate, totalCents: d.quoteCents ?? d.closedCents, netCents: d.netCents ?? d.quoteCents ?? d.closedCents, freight: d.freight, paymentTerms: term , weightKg: d.weightKg ?? null }).returning({ id: dealQuotes.id });
          if (d.items?.length) {
            const icmsPct = await icmsPctFor(lead.uf);
            const list = withIcmsPct(d.items.map((it, n) => ({ ...normalizeItem(it), seq: (n + 1) * 10 })), icmsPct);
            const t = totalsOf(list, 0, await getExtraTaxPct(), icmsPct);
            await tx.update(dealQuotes).set({ productsCents: t.productsCents, ipiCents: t.ipiCents, icmsCents: t.icmsCents, netCents: t.netCents }).where(eq(dealQuotes.id, qrow.id));
            await tx.insert(dealQuoteItems).values(list.map((it) => ({ ...it, dealId: deal.id, quoteId: qrow.id, quoteNumber: d.quoteNumber })));
            await upsertProducts(tx, list);
          }
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

/** O que fazer com linhas que já existem: completar só o que falta ou substituir pelo que veio na planilha. */
export async function applyDealMatches(matches: Match[], policy: DupPolicy, o: { userId: number; fileName: string }) {
  if (policy === "skip" || matches.length === 0) return { updated: 0 };
  let updated = 0;
  const seen = new Set<number>();
  for (const { draft: d, dealId } of matches) {
    if (seen.has(dealId)) continue;
    seen.add(dealId);
    const [cur] = await db.select().from(deals).where(eq(deals.id, dealId));
    if (!cur) continue;
    const term = d.paymentTerms ? await upsertPaymentTerm(db, normTerm(d.paymentTerms)) : null;
    const want: Record<string, unknown> = {
      freight: d.freight, sapCode: d.sapCode, orderNumber: d.orderNumber, quoteNumber: d.quoteNumber, quoteDate: d.quoteDate, paymentTerms: term,
      ...(cur.stage === "ganho" ? { closedOn: d.closedOn, closedValueCents: d.closedCents ?? d.quoteCents, realValueCents: d.realCents } : {}),
      ...(cur.stage === "perdido" ? { lostReason: d.lostReason, closedOn: d.closedOn } : {}),
      ...(cur.stage === "ganho" || cur.stage === "perdido" ? {} : { nextActionAt: d.nextAt ? noon(d.nextAt) : null }),
      handoffNote: d.note,
    };
    const rec = cur as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(want)) {
      if (v === null || v === undefined || v === "") continue;
      if (policy === "overwrite" || rec[k] === null || rec[k] === undefined || rec[k] === "") { if (rec[k] !== v) patch[k] = v; }
    }
    if (!Object.keys(patch).length) continue;
    await db.update(deals).set({ ...patch, updatedAt: new Date() }).where(eq(deals.id, dealId));
    await db.insert(dealEvents).values({ dealId, userId: o.userId, kind: "nota", note: `Planilha ${o.fileName}: ${policy === "overwrite" ? "informações substituídas" : "dados faltantes completados"} (${Object.keys(patch).length} campo(s))` });
    await logAudit(db, { userId: o.userId, entity: "deal", action: policy === "overwrite" ? "substituiu dados pela planilha" : "completou dados pela planilha", field: "Negociação", newValue: Object.keys(patch).join(", "), meta: { negociacao: dealId } });
    updated++;
  }
  return { updated };
}
