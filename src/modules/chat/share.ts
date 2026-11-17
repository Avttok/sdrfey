import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { dealQuoteItems, dealQuotes, deals, db, leadTags, leads, tags, users } from "@/db";
import { fmtBRL, STAGE_META } from "@/config/deals";
import { fmtCnpj, fmtDate } from "@/lib/format";
import type { CurrentUser } from "@/modules/auth/guard";

export type ShareKind = "lead" | "deal" | "quote";
export type ShareItem = { id: number; label: string; sub: string };
export type ShareInfo = { kind: ShareKind; title: string; subtitle?: string; rows: { label: string; value: string }[]; items?: { text: string; value: string }[]; href?: string; editable: boolean; gone?: boolean };

const seesAll = (me: CurrentUser) => me.roles.includes("admin") || me.roles.includes("manager") || !!me.permissions["deals.team"];

/** Quais negociações a conta pode compartilhar: as dela (SDR que repassou ou vendedor), as sem dono (se for vendedor) ou todas (gestão). */
function dealAccess(me: CurrentUser): SQL | undefined {
  if (seesAll(me)) return undefined;
  const mine = [sql`${deals.sellerId} = ${me.id}`, sql`${deals.sdrId} = ${me.id}`];
  if (me.roles.includes("seller")) mine.push(sql`${deals.sellerId} is null`);
  return or(...mine);
}

/** Leads/clientes que a conta pode compartilhar: todos, exceto quem é só vendedor (só os das negociações dele). */
function leadAccess(me: CurrentUser): SQL | undefined {
  const sellerOnly = me.roles.includes("seller") && !me.roles.some((r) => r !== "seller") && !seesAll(me);
  if (!sellerOnly) return undefined;
  return sql`exists (select 1 from deals d where d.lead_id = ${leads.id} and (d.seller_id = ${me.id} or d.seller_id is null))`;
}

const like = (q: string) => `%${q.replace(/[%_\\]/g, "")}%`;

export async function searchShareable(me: CurrentUser, kind: ShareKind, q: string): Promise<ShareItem[]> {
  const term = q.trim();
  if (kind === "lead") {
    const digits = term.replace(/\D/g, "");
    const rows = await db.select({ id: leads.id, company: leads.company, cnpj: leads.cnpj, city: leads.city, uf: leads.uf }).from(leads)
      .where(and(eq(leads.isTest, false), leadAccess(me), term ? or(ilike(leads.company, like(term)), ilike(leads.tradeName, like(term)), digits.length >= 3 ? ilike(leads.cnpj, `%${digits}%`) : undefined) : undefined))
      .orderBy(leads.company).limit(8);
    return rows.map((r) => ({ id: r.id, label: r.company, sub: [r.city && `${r.city}/${r.uf}`, r.cnpj].filter(Boolean).join(" · ") }));
  }
  if (kind === "deal") {
    const rows = await db.select({ id: deals.id, company: leads.company, stage: deals.stage, seller: users.name }).from(deals)
      .innerJoin(leads, eq(leads.id, deals.leadId)).leftJoin(users, eq(users.id, deals.sellerId))
      .where(and(eq(deals.isTest, false), dealAccess(me), term ? or(ilike(leads.company, like(term)), ilike(deals.quoteNumber, like(term))) : undefined))
      .orderBy(desc(deals.updatedAt)).limit(8);
    return rows.map((r) => ({ id: r.id, label: r.company, sub: `${STAGE_META[r.stage].label}${r.seller ? ` · ${r.seller}` : ""}` }));
  }
  const rows = await db.select({ id: dealQuotes.id, number: dealQuotes.number, company: leads.company, net: dealQuotes.netCents, total: dealQuotes.totalCents }).from(dealQuotes)
    .innerJoin(deals, eq(deals.id, dealQuotes.dealId)).innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.isTest, false), dealAccess(me), term ? or(ilike(leads.company, like(term)), ilike(dealQuotes.number, like(term))) : undefined))
    .orderBy(desc(dealQuotes.createdAt)).limit(8);
  return rows.map((r) => ({ id: r.id, label: `Cotação ${r.number ?? "sem número"}`, sub: `${r.company} · ${fmtBRL(r.net ?? r.total)}` }));
}

/** Confere que a conta pode compartilhar o item e devolve o rótulo que fica gravado na mensagem. */
export async function shareLabel(me: CurrentUser, kind: ShareKind, id: number): Promise<string | null> {
  if (kind === "lead") {
    const [r] = await db.select({ company: leads.company }).from(leads).where(and(eq(leads.id, id), eq(leads.isTest, false), leadAccess(me)));
    return r?.company ?? null;
  }
  if (kind === "deal") {
    const [r] = await db.select({ company: leads.company, stage: deals.stage }).from(deals).innerJoin(leads, eq(leads.id, deals.leadId)).where(and(eq(deals.id, id), eq(deals.isTest, false), dealAccess(me)));
    return r ? `${r.company} · ${STAGE_META[r.stage].label}` : null;
  }
  const [r] = await db.select({ number: dealQuotes.number, company: leads.company }).from(dealQuotes).innerJoin(deals, eq(deals.id, dealQuotes.dealId)).innerJoin(leads, eq(leads.id, deals.leadId)).where(and(eq(dealQuotes.id, id), eq(deals.isTest, false), dealAccess(me)));
  return r ? `Cotação ${r.number ?? "sem número"} · ${r.company}` : null;
}

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const phoneFmt = (p: string) => (p.length >= 10 ? `(${p.slice(0, 2)}) ${p.slice(2, p.length - 4)}-${p.slice(-4)}` : p);

/** Dados atuais do item compartilhado, só leitura. Quem é gestão/Adm recebe o link da página completa (o Adm edita lá). */
export async function shareInfo(me: CurrentUser, kind: ShareKind, id: number): Promise<ShareInfo> {
  const mod = me.roles.includes("admin") || me.roles.includes("manager");
  const editable = me.roles.includes("admin");
  const gone = (): ShareInfo => ({ kind, title: "Item indisponível", rows: [], editable: false, gone: true });
  if (kind === "lead") {
    const [r] = await db.select({ l: leads, owner: users.name }).from(leads).leftJoin(users, eq(users.id, leads.ownerId)).where(eq(leads.id, id));
    if (!r) return gone();
    const l = r.l;
    const tg = await db.select({ label: tags.label }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).where(eq(leadTags.leadId, id));
    return { kind, title: l.company, subtitle: l.tradeName ?? undefined, editable, href: mod ? `/leads/${id}` : undefined, rows: [
      { label: "CNPJ", value: dash(fmtCnpj(l.cnpj)) }, { label: "Contato", value: dash([l.contactName, l.roleTitle].filter(Boolean).join(" · ")) },
      { label: "Telefones", value: l.phones.length ? l.phones.map(phoneFmt).join(" · ") : "—" }, { label: "E-mail", value: dash(l.email) },
      { label: "Cidade / UF", value: dash(l.city ? `${l.city}/${l.uf}` : null) }, { label: "Situação cadastral", value: dash(l.registrationStatus) },
      { label: "Responsável", value: dash(r.owner) }, { label: "Tags", value: tg.length ? tg.map((t) => t.label.toUpperCase()).join(" · ") : "—" },
      { label: "Observações", value: dash(l.notes) },
    ] };
  }
  const dealId = kind === "deal" ? id : (await db.select({ d: dealQuotes.dealId }).from(dealQuotes).where(eq(dealQuotes.id, id)))[0]?.d;
  if (!dealId) return gone();
  const [r] = await db.select({ d: deals, company: leads.company, leadId: leads.id, seller: users.name }).from(deals).innerJoin(leads, eq(leads.id, deals.leadId)).leftJoin(users, eq(users.id, deals.sellerId)).where(eq(deals.id, dealId));
  if (!r) return gone();
  const d = r.d;
  if (kind === "deal") {
    const main = d.realValueCents ?? d.netValueCents ?? d.closedValueCents ?? d.valueCents;
    return { kind, title: r.company, subtitle: `Negociação · ${STAGE_META[d.stage].label}`, editable, href: mod ? `/negociacoes/${dealId}` : undefined, rows: [
      { label: "Vendedor", value: dash(r.seller) }, { label: "Valor (sem impostos)", value: main != null ? fmtBRL(main) : "—" },
      { label: "Cotação", value: dash(d.quoteNumber) }, { label: "Pagamento", value: dash(d.paymentTerms) }, { label: "Frete", value: dash(d.freight) },
      { label: "Próximo passo", value: dash([d.nextActionNote, d.nextActionAt && fmtDate(d.nextActionAt.toISOString())].filter(Boolean).join(" · ")) },
      { label: "Nota do repasse", value: dash(d.handoffNote) }, { label: "Motivo da perda", value: d.stage === "perdido" ? dash(d.lostReason) : "—" },
    ] };
  }
  const [q] = await db.select().from(dealQuotes).where(eq(dealQuotes.id, id));
  if (!q) return gone();
  const its = await db.select().from(dealQuoteItems).where(eq(dealQuoteItems.quoteId, id)).orderBy(dealQuoteItems.seq).limit(30);
  return { kind, title: `Cotação ${q.number ?? "sem número"}`, subtitle: r.company, editable, href: mod ? `/negociacoes/${dealId}` : undefined, rows: [
    { label: "Data", value: dash(q.quoteDate ? fmtDate(`${q.quoteDate}T12:00:00-03:00`) : null) }, { label: "Vendedor", value: dash(r.seller) },
    { label: "Valor sem impostos", value: fmtBRL(q.netCents) }, { label: "Total com impostos", value: fmtBRL(q.totalCents) },
    { label: "IPI", value: fmtBRL(q.ipiCents) }, { label: "ICMS", value: fmtBRL(q.icmsCents) },
    { label: "Frete", value: dash(q.freight ? `${q.freight} · ${fmtBRL(q.freightCents)}` : null) }, { label: "Pagamento", value: dash(q.paymentTerms) },
    { label: "Link Salesforce", value: dash(q.link) }, { label: "Observação", value: dash(q.note) },
  ], items: its.map((i) => ({ text: `${i.description}${i.clientRef ? ` (${i.clientRef})` : ""} × ${i.qty}`, value: fmtBRL(i.totalCents) })) };
}
