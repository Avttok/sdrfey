import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getExtraTaxPct, getIcmsRule, icmsPctFor } from "@/modules/quotes/db";
import { pickIcmsPct } from "@/modules/quotes/icms";
import { dealEvents, dealQuoteItems, dealQuotes, deals, db, leadChannels, leads, leadTags, paymentTerms, tagGroups, tags, users, type DealStage } from "@/db";
import { ALERT_RULES } from "@/config/deals";
import { getSettings } from "@/modules/settings/get";
import { soldBeforeThisMonth } from "./portfolio";

export type DealAlertKind = "pool" | "novo" | "retorno" | "cobrar" | "parado";
export type DealAlert = { kind: DealAlertKind; tone: "danger" | "warn" | "info"; text: string };

export type DealRow = {
  /** Preenchidos por onePerClient: quantas negociações o cliente já teve e o que já faturou. */
  cycles?: number; billedCount?: number; billedCents?: number;
  id: number; leadId: number; stage: DealStage; company: string; city: string | null; uf: string | null; contactName: string | null;
  phone: string | null; email: string | null; salesforceUrl: string | null; eoxUrl: string | null;
  sellerId: number | null; sellerName: string | null; sdrId: number | null; sdrName: string | null; handoffNote: string | null;
  valueCents: number | null; netValueCents: number | null; mainCents: number | null; createdAt: string; claimedAt: string | null; quoteSentAt: string | null; lastContactAt: string | null;
  nextActionAt: string | null; nextActionNote: string | null; lostReason: string | null; closedAt: string | null;
  freight: "CIF" | "FOB" | "RED" | null; sapCode: string | null; orderNumber: string | null; quoteNumber: string | null; quoteDate: string | null; closedOn: string | null;
  cnpj: string; addressLine: string | null; stateReg: string | null; closedValueCents: number | null; realValueCents: number | null; expired: boolean; paymentTerms: string | null; color: string | null; isReactivation: boolean;
  alerts: DealAlert[];
};

const hoursAgo = (iso: string, now: number) => (now - new Date(iso).getTime()) / 3600_000;
const ago = (h: number) => (h < 1 ? "agora" : h < 24 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} d`);

/** Avisos de uma negociação aberta. Tudo calculado na hora: não há o que “esquecer” de marcar. */
export function dealAlerts(d: Pick<DealRow, "stage" | "sellerId" | "createdAt" | "claimedAt" | "quoteSentAt" | "lastContactAt" | "nextActionAt" | "nextActionNote">, now = Date.now(), rules: { newUntouchedHours: number; poolHours: number; quoteChaseDays: number; staleDays: number } = ALERT_RULES): DealAlert[] {
  if (d.stage === "ganho" || d.stage === "perdido") return [];
  const out: DealAlert[] = [];
  if (!d.sellerId) {
    const h = hoursAgo(d.createdAt, now);
    out.push({ kind: "pool", tone: h >= rules.poolHours ? "danger" : "info", text: h >= rules.poolHours ? `Sem vendedor há ${ago(h)}` : "Aguardando vendedor" });
    return out;
  }
  if (d.stage === "novo") {
    const h = hoursAgo(d.claimedAt ?? d.createdAt, now);
    if (h >= rules.newUntouchedHours) out.push({ kind: "novo", tone: "danger", text: `Ligar agora · sem contato há ${ago(h)}` });
  }
  if (d.nextActionAt && new Date(d.nextActionAt).getTime() <= now) out.push({ kind: "retorno", tone: "danger", text: d.nextActionNote ? `Retorno vencido: ${d.nextActionNote}` : "Retorno vencido" });
  if (d.stage === "cotacao" && d.quoteSentAt) {
    const days = (now - new Date(d.quoteSentAt).getTime()) / 86400_000;
    const since = d.lastContactAt && new Date(d.lastContactAt) > new Date(d.quoteSentAt) ? (now - new Date(d.lastContactAt).getTime()) / 86400_000 : days;
    if (since >= rules.quoteChaseDays && !out.some((a) => a.kind === "retorno")) out.push({ kind: "cobrar", tone: "warn", text: `Cobrar cotação · enviada há ${Math.floor(days)} d` });
  }
  if ((d.stage === "contato" || d.stage === "negociacao") && d.lastContactAt && !out.length) {
    const days = (now - new Date(d.lastContactAt).getTime()) / 86400_000;
    if (days >= rules.staleDays) out.push({ kind: "parado", tone: "warn", text: `Sem contato há ${Math.floor(days)} d` });
  }
  return out;
}

const seller = alias(users, "seller");
const sdr = alias(users, "sdr");

/** Negociações visíveis para a pessoa: as dela e as do grupo (sem dono); com “deals.team”, todas. */
/** Um cartão por cliente: a negociação aberta (a mais recente) ou, sem aberta, a última encerrada. O resto do histórico fica dentro da janela do cliente. */
export function onePerClient<T extends DealRow>(rows: T[]): T[] {
  const by = new Map<number, T[]>();
  for (const r of rows) by.set(r.leadId, [...(by.get(r.leadId) ?? []), r]);
  const isOpen = (d: DealRow) => d.stage !== "ganho" && d.stage !== "perdido";
  return [...by.values()].map((g) => {
    const rep = g.find(isOpen) ?? g[0];
    const won = g.filter((d) => d.stage === "ganho");
    return { ...rep, cycles: g.length, billedCount: won.length, billedCents: won.reduce((a, d) => a + (d.mainCents ?? 0), 0) };
  }).sort((a, b) => (a.id === b.id ? 0 : rows.findIndex((r) => r.id === a.id) - rows.findIndex((r) => r.id === b.id)));
}

export async function listDeals(meId: number, team: boolean, opts: { includeTest?: boolean } = {}): Promise<DealRow[]> {
  const cfg = await getSettings();
  const rules = { newUntouchedHours: cfg.deal_new_untouched_hours, poolHours: cfg.deal_pool_hours, quoteChaseDays: cfg.deal_quote_chase_days, staleDays: cfg.deal_stale_days };
  const rows = await db
    .select({
      d: deals, company: leads.company, city: leads.city, uf: leads.uf, contactName: leads.contactName, phones: leads.phones, email: leads.email, address: leads.address, neighborhood: leads.neighborhood, zip: leads.zip, stateReg: leads.stateReg,
      salesforceUrl: leads.salesforceUrl, eoxUrl: leads.eoxUrl, leadSap: leads.sapCode, leadCnpj: leads.cnpj, sellerName: seller.name, sdrName: sdr.name,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(seller, eq(seller.id, deals.sellerId))
    .leftJoin(sdr, eq(sdr.id, deals.sdrId))
    .where(and(sql`(${deals.sellerId} is null or ${seller.inMetrics} or ${deals.sellerId} = ${meId})`, team ? undefined : sql`(${deals.sellerId} = ${meId} or ${deals.sellerId} is null)`, opts.includeTest ? undefined : eq(deals.isTest, false), eq(deals.importPending, false)))
    .orderBy(desc(deals.updatedAt));
  const iso = (v: Date | null) => (v ? v.toISOString() : null);
  const out = rows.map(({ d, ...x }) => {
    const row = {
      id: d.id, leadId: d.leadId, stage: d.stage, company: x.company, city: x.city, uf: x.uf, contactName: x.contactName, phone: x.phones?.[0] ?? null, email: x.email,
      salesforceUrl: x.salesforceUrl, eoxUrl: x.eoxUrl, sellerId: d.sellerId, sellerName: x.sellerName, sdrId: d.sdrId, sdrName: x.sdrName, handoffNote: d.handoffNote,
      valueCents: d.valueCents, netValueCents: d.netValueCents, mainCents: d.realValueCents ?? d.netValueCents ?? d.closedValueCents ?? d.valueCents, createdAt: d.createdAt.toISOString(), claimedAt: iso(d.claimedAt), quoteSentAt: iso(d.quoteSentAt), lastContactAt: iso(d.lastContactAt),
      nextActionAt: iso(d.nextActionAt), nextActionNote: d.nextActionNote, lostReason: d.lostReason, closedAt: iso(d.closedAt),
      freight: d.freight, sapCode: d.sapCode ?? x.leadSap, orderNumber: d.orderNumber, quoteNumber: d.quoteNumber, quoteDate: d.quoteDate, closedOn: d.closedOn,
      cnpj: x.leadCnpj, addressLine: [x.address, x.neighborhood, x.zip ? x.zip.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null].filter(Boolean).join(" · ") || null, stateReg: x.stateReg, closedValueCents: d.closedValueCents, realValueCents: d.realValueCents, expired: soldBeforeThisMonth({ stage: d.stage, closedOn: d.closedOn, closedAt: iso(d.closedAt) }), paymentTerms: d.paymentTerms, color: d.color, isReactivation: d.isReactivation,
    };
    return { ...row, alerts: dealAlerts(row, Date.now(), rules) };
  });
  /* Quem vendeu em mês anterior saiu da carteira do vendedor; só gestor/admin ainda enxerga. */
  return team ? out : out.filter((d) => !d.expired);
}

export async function getDeal(id: number) {
  const [row] = await db.select({ id: deals.id }).from(deals).where(eq(deals.id, id));
  if (!row) return null;
  const [dealUf] = await db.select({ uf: leads.uf }).from(leads).innerJoin(deals, eq(deals.leadId, leads.id)).where(eq(deals.id, id));
  const events = await db
    .select({ id: dealEvents.id, kind: dealEvents.kind, note: dealEvents.note, valueCents: dealEvents.valueCents, at: dealEvents.at, by: users.name })
    .from(dealEvents).leftJoin(users, eq(users.id, dealEvents.userId)).where(eq(dealEvents.dealId, id)).orderBy(desc(dealEvents.at), desc(dealEvents.id));
  const phones = await db.select({ value: leadChannels.value, label: leadChannels.label }).from(leadChannels)
    .innerJoin(deals, eq(deals.leadId, leadChannels.leadId)).where(and(eq(deals.id, id), eq(leadChannels.kind, "phone"), eq(leadChannels.wrong, false)));
  const [quoteRows, items, tagRows, terms] = await Promise.all([
    db.select().from(dealQuotes).where(eq(dealQuotes.dealId, id)).orderBy(desc(dealQuotes.id)),
    db.select().from(dealQuoteItems).where(eq(dealQuoteItems.dealId, id)).orderBy(asc(dealQuoteItems.seq)),
    db.select({ group: tagGroups.name, label: tags.label, color: tags.color }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).innerJoin(tagGroups, eq(tagGroups.key, tags.groupKey)).innerJoin(deals, eq(deals.leadId, leadTags.leadId)).where(eq(deals.id, id)).orderBy(asc(tagGroups.sort), asc(tags.sort)),
    db.select({ name: paymentTerms.name }).from(paymentTerms).where(eq(paymentTerms.active, true)).orderBy(asc(paymentTerms.name)),
  ]);
  const quotes = quoteRows.map((q) => ({ ...q, createdAt: q.createdAt.toISOString(), items: items.filter((i) => i.quoteId === q.id).map((i) => ({ id: i.id, seq: i.seq, productCode: i.productCode, clientRef: i.clientRef, description: i.description, kind: i.kind, qty: Number(i.qty), packQty: i.packQty == null ? null : Number(i.packQty), unit: i.unit, icmsCents: i.icmsCents, ipiCents: i.ipiCents, unitCents: i.unitCents, totalCents: i.totalCents })) }));
  return { events: events.map((e) => ({ ...e, at: e.at.toISOString() })), phones, quotes, tags: tagRows, terms: terms.map((t) => t.name), extraPct: await getExtraTaxPct(), icmsPct: await icmsPctFor(dealUf?.uf ?? null), icmsRatePct: pickIcmsPct({ ...(await getIcmsRule()), mode: "rate" }, dealUf?.uf ?? null) };
}

/** Quantos avisos pendentes a pessoa tem (para a bolinha do menu). */
export function countAlerts(rows: DealRow[], meId: number) {
  return rows.filter((r) => r.alerts.length && (r.sellerId === meId || (!r.sellerId))).length;
}

export type SellerHistFilters = { q?: string; stage?: DealStage; from?: string; to?: string };
export type SellerHistRow = { id: number; leadId: number; company: string; city: string | null; uf: string | null; stage: DealStage; valueCents: number | null; createdAt: string; closedAt: string | null; lastAt: string; contacts: number; quotes: number; lostReason: string | null };

/** Tudo o que o vendedor já trabalhou: negociações dele com contatos, cotações e resultado. */
export async function sellerHistory(userId: number, f: SellerHistFilters): Promise<SellerHistRow[]> {
  const c = [sql`d.seller_id = ${userId}`, sql`not d.is_test`];
  if (f.q) c.push(sql`(l.company ilike ${`%${f.q.replace(/[%_]/g, "")}%`} or l.trade_name ilike ${`%${f.q.replace(/[%_]/g, "")}%`})`);
  if (f.stage) c.push(sql`d.stage = ${f.stage}`);
  if (f.from) c.push(sql`d.updated_at >= ${new Date(`${f.from}T00:00:00-03:00`).toISOString()}::timestamptz`);
  if (f.to) c.push(sql`d.updated_at <= ${new Date(`${f.to}T23:59:59.999-03:00`).toISOString()}::timestamptz`);
  const rows = await db.execute<{ id: number; lead_id: number; company: string; city: string | null; uf: string | null; stage: DealStage; value: number | null; created_at: Date; closed_at: Date | null; last_at: Date; contacts: number; quotes: number; lost: string | null }>(sql`
    select d.id, d.lead_id, l.company, l.city, l.uf, d.stage, coalesce(d.real_value_cents, d.net_value_cents, d.closed_value_cents, d.value_cents) as value, d.created_at, d.closed_at, d.updated_at as last_at, d.lost_reason as lost,
      (select count(*)::int from deal_events e where e.deal_id = d.id and e.kind in ('ligacao','whatsapp','email')) as contacts,
      (select count(*)::int from deal_events e where e.deal_id = d.id and e.kind = 'cotacao') as quotes
    from deals d join leads l on l.id = d.lead_id where ${sql.join(c, sql` and `)} order by d.updated_at desc limit 400`);
  return rows.map((r) => ({ id: r.id, leadId: r.lead_id, company: r.company, city: r.city, uf: r.uf, stage: r.stage, valueCents: r.value, createdAt: new Date(r.created_at).toISOString(), closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null, lastAt: new Date(r.last_at).toISOString(), contacts: r.contacts, quotes: r.quotes, lostReason: r.lost }));
}

/** Bolinhas do menu: quantas negociações pedem atenção agora. */
const badgeCache = new Map<number, { at: number; v: Record<string, number> }>();

/** Aviso nas abas. Guardado 20 s por pessoa na memória: roda em toda página e a conta é pesada. */
export async function navBadges(user: { id: number; permissions: Record<string, boolean>; roles: string[] }): Promise<Record<string, number>> {
  if (!user.permissions["tab.negociacoes"]) return {};
  const hit = badgeCache.get(user.id);
  if (hit && Date.now() - hit.at < 20_000) return hit.v;
  const v = await computeBadges(user);
  badgeCache.set(user.id, { at: Date.now(), v });
  if (badgeCache.size > 200) badgeCache.clear();
  return v;
}

async function computeBadges(user: { id: number; permissions: Record<string, boolean>; roles: string[] }): Promise<Record<string, number>> {
  const team = !!user.permissions["deals.team"];
  const rows = await listDeals(user.id, team);
  const n = rows.filter((r) => r.alerts.length && (team || r.sellerId === user.id || (!r.sellerId && user.roles.includes("seller")))).length;
  return n ? { "/negociacoes": n } : {};
}
