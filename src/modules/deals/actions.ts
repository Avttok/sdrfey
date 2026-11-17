"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dealEvents, dealQuoteItems, deals, interactions, leads, tags, users, type DealStage } from "@/db";
import { desc } from "drizzle-orm";
import { TAG } from "@/config/tags";
import { enrichLead } from "@/modules/enrich/enrich";
import { isValidCnpj, normalizeCnpj } from "@/modules/import/normalize";
import { leftPortfolio } from "./portfolio";
import { setLeadTags } from "@/modules/tags/apply";
import type { QuoteItem } from "@/modules/quotes/parse";
import { db } from "@/db";
import { ALERT_RULES, parseMoneyToCents, STAGE_META } from "@/config/deals";
import { logAudit, type AuditEntry } from "@/modules/audit/log";
import { requirePerm, type CurrentUser } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";

const fail = (message: string): ActionResult => ({ ok: false, message });
const refresh = (id: number) => { revalidatePath("/negociacoes"); revalidatePath(`/negociacoes/${id}`); revalidatePath("/painel"); revalidatePath("/metas"); revalidatePath("/historico"); };

/** Carrega a negociação e confere se esta pessoa pode mexer nela (dona, ou gestor com “deals.team”). */
async function load(id: number): Promise<{ me: CurrentUser; deal: typeof deals.$inferSelect } | { error: string }> {
  const me = await requirePerm("tab.negociacoes");
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  if (!deal) return { error: "Negociação não encontrada." };
  const team = !!me.permissions["deals.team"];
  if (deal.sellerId !== me.id && !team) return { error: deal.sellerId ? "Esta negociação é de outro vendedor." : "Assuma a negociação primeiro." };
  return { me, deal };
}

const closed = (s: DealStage) => s === "ganho" || s === "perdido";

/** Vendedor pega uma negociação do grupo. Quem clicar primeiro fica com ela. */
export async function claimDealAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("tab.negociacoes");
  if (!me.roles.includes("seller") && !me.permissions["deals.team"]) return fail("Só vendedores podem assumir negociações.");
  const res = await db.transaction(async (tx) => {
    const [d] = await tx.update(deals).set({ sellerId: me.id, claimedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(deals.id, id), sql`${deals.sellerId} is null`, sql`${deals.stage} not in ('ganho','perdido')`)).returning({ leadId: deals.leadId });
    if (!d) return false;
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "assumido" });
    await logAudit(tx, { userId: me.id, leadId: d.leadId, entity: "deal", action: "assumiu negociação", field: "Vendedor", newValue: me.name, meta: { negociacao: id } });
    return true;
  });
  if (!res) return fail("Outro vendedor já assumiu esta negociação.");
  refresh(id);
  return { ok: true, message: "Negociação assumida. Ligue agora!" };
}

/** Registra um contato (ligação, WhatsApp, e-mail) ou uma anotação, e opcionalmente o próximo passo. */
export async function logContactAction(id: number, input: { kind: "ligacao" | "whatsapp" | "email" | "nota"; note: string; nextAt: string | null; nextNote: string | null }): Promise<ActionResult> {
  const p = z.object({ kind: z.enum(["ligacao", "whatsapp", "email", "nota"]), note: z.string().trim().max(2000), nextAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).nullable(), nextNote: z.string().trim().max(300).nullable() }).safeParse(input);
  if (!p.success) return fail("Confira os campos.");
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  if (closed(r.deal.stage)) return fail("Esta negociação já foi encerrada. Reabra para continuar.");
  const { me, deal } = r;
  const { kind, note, nextAt, nextNote } = p.data;
  if (kind === "nota" && !note) return fail("Escreva a anotação.");
  const next = nextAt ? new Date(nextAt.length === 10 ? `${nextAt}T09:00:00-03:00` : `${nextAt}:00-03:00`) : null;
  await db.transaction(async (tx) => {
    const contact = kind !== "nota";
    const stage: DealStage = contact && deal.stage === "novo" ? "contato" : deal.stage;
    await tx.update(deals).set({
      stage,
      lastContactAt: contact ? new Date() : deal.lastContactAt,
      nextActionAt: next ?? (contact ? null : deal.nextActionAt),
      nextActionNote: next ? nextNote : contact ? null : deal.nextActionNote,
      updatedAt: new Date(),
    }).where(eq(deals.id, id));
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind, note: note || null });
    if (next) await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "retorno", note: nextNote ?? null });
    if (stage !== deal.stage) await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "etapa", note: `${STAGE_META[deal.stage].label} → ${STAGE_META[stage].label}` });
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: kind === "nota" ? "anotou na negociação" : "registrou contato", field: "Negociação", newValue: kind, meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true, message: kind === "nota" ? "Anotação salva." : "Contato registrado." };
}

/** Cotação enviada: guarda valor e data e já agenda a cobrança (aviso). */
export async function sendQuoteAction(id: number, input: { value: string; note: string; followupDays: number; data?: DealDataInput; items?: QuoteItem[] }): Promise<ActionResult> {
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (closed(deal.stage)) return fail("Esta negociação já foi encerrada.");
  const cents = parseMoneyToCents(input.value);
  if (cents === null || cents <= 0) return fail("Informe o valor da cotação (ex.: 12.500,00).");
  const days = Number.isInteger(input.followupDays) && input.followupDays >= 1 && input.followupDays <= 30 ? input.followupDays : ALERT_RULES.defaultFollowupDays;
  const next = new Date(Date.now() + days * 86400_000);
  const note = input.note.trim().slice(0, 2000) || null;
  const extra = dataPatch({ ...input.data, quoteValue: undefined, closedValue: undefined, closedOn: undefined, isReactivation: undefined });
  const parsedItems = itemsSchema.safeParse(input.items ?? []);
  if (!parsedItems.success) return fail("Itens da cotação inválidos.");
  const items = parsedItems.data;
  if (extra.error) return fail(extra.error);
  await db.transaction(async (tx) => {
    await applyData(tx, me, deal, extra.patch);
    if (items.length) {
      const qn = extra.patch.quoteNumber ?? deal.quoteNumber ?? null;
      await tx.delete(dealQuoteItems).where(and(eq(dealQuoteItems.dealId, id), qn ? eq(dealQuoteItems.quoteNumber, qn) : sql`${dealQuoteItems.quoteNumber} is null`));
      await tx.insert(dealQuoteItems).values(items.map((i) => ({ ...i, dealId: id, quoteNumber: qn })));
      await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "registrou itens da cotação", field: "Itens", newValue: items.length, meta: { negociacao: id } });
    }
    await tx.update(deals).set({ stage: "cotacao", valueCents: cents, quoteSentAt: new Date(), lastContactAt: new Date(), nextActionAt: next, nextActionNote: "Cobrar retorno da cotação", updatedAt: new Date() }).where(eq(deals.id, id));
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "cotacao", note, valueCents: cents });
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "enviou cotação", field: "Valor", oldValue: deal.valueCents, newValue: cents, meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true, message: `Cotação registrada. Aviso de cobrança em ${days} ${days === 1 ? "dia" : "dias"}.` };
}

const MOVABLE: DealStage[] = ["novo", "contato", "cotacao", "negociacao"];

export async function setStageAction(id: number, stage: DealStage): Promise<ActionResult> {
  if (!MOVABLE.includes(stage)) return fail("Etapa inválida.");
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (closed(deal.stage)) return fail("Esta negociação já foi encerrada. Reabra para continuar.");
  if (deal.stage === stage) return { ok: true };
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ stage, updatedAt: new Date() }).where(eq(deals.id, id));
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "etapa", note: `${STAGE_META[deal.stage].label} → ${STAGE_META[stage].label}` });
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "mudou etapa", field: "Etapa", oldValue: STAGE_META[deal.stage].label, newValue: STAGE_META[stage].label, meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true };
}

export async function closeDealAction(id: number, input: { won: boolean; value?: string; reason?: string; closedOn?: string | null; data?: DealDataInput }): Promise<ActionResult> {
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (closed(deal.stage)) return fail("Esta negociação já foi encerrada.");
  let cents = deal.closedValueCents ?? deal.valueCents;
  if (input.won) {
    if (input.value?.trim()) { cents = parseMoneyToCents(input.value); if (cents === null) return fail("Valor da venda inválido."); }
    if (!cents) return fail("Informe o valor da venda.");
  } else if (!input.reason?.trim()) return fail("Conte o motivo da perda.");
  const reason = input.reason?.trim().slice(0, 500) || null;
  const extra = input.won ? dataPatch({ ...input.data, quoteValue: undefined, closedValue: undefined, closedOn: undefined }) : { patch: {} };
  if (extra.error) return fail(extra.error);
  await db.transaction(async (tx) => {
    await applyData(tx, me, deal, extra.patch);
    await tx.update(deals).set({ stage: input.won ? "ganho" : "perdido", closedValueCents: input.won ? cents : deal.closedValueCents, closedOn: input.won ? (input.closedOn && isoDate.safeParse(input.closedOn).success ? input.closedOn : null) : null, lostReason: input.won ? null : reason, closedAt: new Date(), nextActionAt: null, nextActionNote: null, sellerId: deal.sellerId ?? me.id, updatedAt: new Date() }).where(eq(deals.id, id));
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: input.won ? "ganho" : "perdido", note: reason, valueCents: input.won ? cents : null });
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: input.won ? "fechou venda" : "perdeu negócio", field: "Negociação", newValue: input.won ? cents : reason, meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true, message: input.won ? "Venda fechada! 🎉" : "Negociação encerrada como perdida." };
}

export async function reopenDealAction(id: number): Promise<ActionResult> {
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (!closed(deal.stage)) return { ok: true };
  const open = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.leadId, deal.leadId), sql`${deals.stage} not in ('ganho','perdido')`));
  if (open.length) return fail("Este lead já tem outra negociação aberta.");
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ stage: "contato", closedAt: null, closedOn: null, lostReason: null, updatedAt: new Date() }).where(eq(deals.id, id));
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "reaberto" });
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "reabriu negociação", field: "Negociação", meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true, message: "Negociação reaberta." };
}

/** Gestor (deals.team) passa a negociação para outro vendedor ou devolve ao grupo. */
export async function reassignDealAction(id: number, sellerId: number | null): Promise<ActionResult> {
  const me = await requirePerm("deals.team");
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  if (!deal) return fail("Negociação não encontrada.");
  if (sellerId) {
    const [s] = await db.select({ roles: users.roles, active: users.active }).from(users).where(eq(users.id, sellerId));
    if (!s?.active || !s.roles.includes("seller")) return fail("Vendedor inválido.");
  }
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ sellerId, claimedAt: sellerId ? new Date() : null, updatedAt: new Date() }).where(eq(deals.id, id));
    await tx.insert(dealEvents).values({ dealId: id, userId: me.id, kind: "repassado", note: sellerId ? null : "Devolvida ao grupo" });
    await logAudit(tx, { userId: me.id, leadId: deal.leadId, entity: "deal", action: "trocou vendedor", field: "Vendedor", oldValue: deal.sellerId, newValue: sellerId, meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true, message: "Negociação atualizada." };
}

/** Links do cliente no Salesforce e no CRM (EOX). Vendedor edita pela negociação; SDR/gestor pela página do lead. */
export async function saveLeadLinksAction(leadId: number, input: { salesforceUrl: string; eoxUrl: string }): Promise<ActionResult> {
  const me = await requirePerm("tab.leads");
  const clean = (v: string) => { const t = v.trim(); return t ? (/^https?:\/\/\S+$/i.test(t) && t.length <= 600 ? t : undefined) : null; };
  const sf = clean(input.salesforceUrl), eox = clean(input.eoxUrl);
  if (sf === undefined || eox === undefined) return fail("Os links precisam começar com https://.");
  const [b] = await db.select({ salesforceUrl: leads.salesforceUrl, eoxUrl: leads.eoxUrl }).from(leads).where(eq(leads.id, leadId));
  if (!b) return fail("Lead não encontrado.");
  if (b.salesforceUrl === sf && b.eoxUrl === eox) return { ok: true };
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ salesforceUrl: sf, eoxUrl: eox, updatedAt: new Date() }).where(eq(leads.id, leadId));
    const out: AuditEntry[] = [];
    if (b.salesforceUrl !== sf) out.push({ userId: me.id, leadId, entity: "lead", action: "alterou", field: "Link do Salesforce", oldValue: b.salesforceUrl, newValue: sf });
    if (b.eoxUrl !== eox) out.push({ userId: me.id, leadId, entity: "lead", action: "alterou", field: "Link do CRM (EOX)", oldValue: b.eoxUrl, newValue: eox });
    await logAudit(tx, out);
  });
  revalidatePath(`/leads/${leadId}`); revalidatePath("/negociacoes");
  return { ok: true, message: "Links salvos." };
}

const cents = z.number().int().nullable();
const itemsSchema = z.array(z.object({
  seq: z.number().int(), productCode: z.string().max(40), clientRef: z.string().max(120).nullable(), description: z.string().max(300), kind: z.string().max(40).nullable(),
  qty: z.number().min(0).max(1e9), packQty: z.number().min(0).max(1e9).nullable(), unit: z.string().max(8).nullable(),
  icmsCents: cents, ipiCents: cents, unitCents: cents, totalCents: cents,
})).max(300);
const FREIGHTS = ["CIF", "FOB", "RED"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type DealDataInput = {
  freight?: string | null; sapCode?: string | null; orderNumber?: string | null; quoteNumber?: string | null;
  quoteDate?: string | null; closedOn?: string | null; quoteValue?: string | null; closedValue?: string | null; realValue?: string | null;
  paymentTerms?: string | null; isReactivation?: boolean;
};

/** Converte o formulário de dados comerciais no que vai para o banco. Só mexe nos campos enviados. */
function dataPatch(input: DealDataInput): { patch: Partial<typeof deals.$inferInsert>; error?: string } {
  const patch: Partial<typeof deals.$inferInsert> = {};
  const txt = (v: string | null | undefined, max: number) => { const t = (v ?? "").trim().slice(0, max); return t || null; };
  if (input.freight !== undefined) {
    const f = (input.freight ?? "").toUpperCase();
    if (f && !FREIGHTS.includes(f as never)) return { patch, error: "Frete deve ser CIF, FOB ou RED." };
    patch.freight = (f || null) as "CIF" | "FOB" | "RED" | null;
  }
  if (input.sapCode !== undefined) patch.sapCode = txt(input.sapCode, 30)?.replace(/^0+(?=\d)/, "") ?? null;
  if (input.orderNumber !== undefined) patch.orderNumber = txt(input.orderNumber, 40);
  if (input.quoteNumber !== undefined) patch.quoteNumber = txt(input.quoteNumber, 40);
  if (input.paymentTerms !== undefined) patch.paymentTerms = txt(input.paymentTerms, 120);
  for (const [k, label] of [["quoteDate", "Data da cotação"], ["closedOn", "Data fechada"]] as const) {
    if (input[k] === undefined) continue;
    const v = (input[k] ?? "").trim();
    if (v && !isoDate.safeParse(v).success) return { patch, error: `${label} inválida.` };
    patch[k] = v || null;
  }
  for (const [k, label, col] of [["quoteValue", "Valor da cotação", "valueCents"], ["closedValue", "Valor fechado", "closedValueCents"], ["realValue", "Valor real (após impostos)", "realValueCents"]] as const) {
    if (input[k] === undefined) continue;
    const v = (input[k] ?? "").trim();
    if (!v) { patch[col] = null; continue; }
    const c = parseMoneyToCents(v);
    if (c === null) return { patch, error: `${label} inválido (ex.: 12.500,00).` };
    patch[col] = c;
  }
  if (input.isReactivation !== undefined) patch.isReactivation = !!input.isReactivation;
  return { patch };
}

const DATA_LABEL: Record<string, string> = { freight: "Frete", sapCode: "Código SAP", orderNumber: "Nº do pedido", quoteNumber: "Nº da cotação", quoteDate: "Data da cotação", closedOn: "Data fechada", valueCents: "Valor da cotação", closedValueCents: "Valor fechado", realValueCents: "Valor real (após impostos)", paymentTerms: "Condição de pagamento", isReactivation: "Reativação" };

/** Grava os campos comerciais e registra no histórico o que mudou. Código SAP também vai para o cadastro do cliente. */
async function applyData(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], me: CurrentUser, deal: typeof deals.$inferSelect, patch: Partial<typeof deals.$inferInsert>) {
  const out: AuditEntry[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const old = (deal as Record<string, unknown>)[k] ?? null;
    if ((old ?? null) !== (v ?? null)) out.push({ userId: me.id, leadId: deal.leadId, entity: "deal", action: "alterou dados da negociação", field: DATA_LABEL[k] ?? k, oldValue: old, newValue: v, meta: { negociacao: deal.id } });
  }
  if (!out.length) return;
  await tx.update(deals).set({ ...patch, updatedAt: new Date() }).where(eq(deals.id, deal.id));
  if (patch.sapCode) {
    const [l] = await tx.select({ sapCode: leads.sapCode }).from(leads).where(eq(leads.id, deal.leadId));
    if (l && l.sapCode !== patch.sapCode) {
      await tx.update(leads).set({ sapCode: patch.sapCode, updatedAt: new Date() }).where(eq(leads.id, deal.leadId));
      out.push({ userId: me.id, leadId: deal.leadId, entity: "lead", action: "alterou", field: "Código SAP", oldValue: l.sapCode, newValue: patch.sapCode });
    }
  }
  await logAudit(tx, out);
}

/** Vendedor edita frete, SAP, pedido, cotação, datas e valores (também depois de fechada, para corrigir). */
export async function saveDealDataAction(id: number, input: DealDataInput): Promise<ActionResult> {
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { patch, error } = dataPatch(input);
  if (error) return fail(error);
  await db.transaction((tx) => applyData(tx, r.me, r.deal, patch));
  refresh(id);
  return { ok: true, message: "Dados salvos." };
}

/** Cada vendedor escolhe a cor da negociação para reconhecer o cliente de relance. */
export async function setDealColorAction(id: number, color: string | null): Promise<ActionResult> {
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) return fail("Cor inválida.");
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const c = color ? color.toLowerCase() : null;
  if (r.deal.color === c) return { ok: true };
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ color: c }).where(eq(deals.id, id));
    await logAudit(tx, { userId: r.me.id, leadId: r.deal.leadId, entity: "deal", action: "mudou cor da negociação", field: "Cor", oldValue: r.deal.color, newValue: c, meta: { negociacao: id } });
  });
  refresh(id);
  return { ok: true };
}

export type CnpjLookup =
  | { ok: false; message: string }
  | { ok: true; cnpj: string; found: false }
  | { ok: true; cnpj: string; found: true; lead: { id: number; company: string; tradeName: string | null; city: string | null; uf: string | null; contactName: string | null; phones: string[]; email: string | null; sapCode: string | null; status: string | null };
      openDeal: { id: number; sellerName: string | null } | null; leftPortfolio: boolean; attendance: { at: string; by: string | null; channel: string; note: string | null }[]; deals: number };

/** Procura um CNPJ no nosso banco: traz o cadastro e o que os SDRs já fizeram com ele. */
export async function lookupCnpjAction(raw: string): Promise<CnpjLookup> {
  await requirePerm("tab.negociacoes");
  const { cnpj } = normalizeCnpj(raw);
  if (!cnpj || !isValidCnpj(cnpj)) return { ok: false, message: "CNPJ inválido. Confira os 14 dígitos." };
  const [l] = await db.select().from(leads).where(eq(leads.cnpj, cnpj));
  if (!l) return { ok: true, cnpj, found: false };
  const [att, ds] = await Promise.all([
    db.select({ at: interactions.at, by: users.name, channel: interactions.channel, label: tags.label, note: interactions.note }).from(interactions)
      .leftJoin(users, eq(users.id, interactions.userId)).leftJoin(tags, and(eq(tags.groupKey, "meio"), eq(tags.key, interactions.channel)))
      .where(and(eq(interactions.leadId, l.id), eq(interactions.isTest, false))).orderBy(desc(interactions.at)).limit(6),
    db.select({ id: deals.id, stage: deals.stage, sellerName: users.name }).from(deals).leftJoin(users, eq(users.id, deals.sellerId)).where(eq(deals.leadId, l.id)),
  ]);
  const open = ds.find((d) => !closed(d.stage));
  return {
    ok: true, cnpj, found: true,
    lead: { id: l.id, company: l.company, tradeName: l.tradeName, city: l.city, uf: l.uf, contactName: l.contactName, phones: l.phones, email: l.email, sapCode: l.sapCode, status: l.registrationStatus },
    openDeal: open ? { id: open.id, sellerName: open.sellerName } : null,
    leftPortfolio: !!(await db.execute<{ x: boolean }>(sql`select ${leftPortfolio(sql`${l.id}`)} as x`))[0]?.x,
    attendance: att.map((a) => ({ at: a.at.toISOString(), by: a.by, channel: a.label ?? a.channel, note: a.note })),
    deals: ds.length,
  };
}

export type NewDealInput = { cnpj: string; company: string; contactName: string; phone: string; note: string; color: string | null; data: DealDataInput; items?: QuoteItem[] };

/** Vendedor abre uma negociação por conta própria (algo que veio por fora, sem passar pelo SDR). CNPJ obrigatório. */
export async function createDealManualAction(input: NewDealInput): Promise<ActionResult & { id?: number }> {
  const me = await requirePerm("tab.negociacoes");
  if (!me.roles.includes("seller") && !me.permissions["deals.team"]) return fail("Só vendedores podem abrir negociações.");
  const { cnpj } = normalizeCnpj(input.cnpj);
  if (!cnpj || !isValidCnpj(cnpj)) return fail("O CNPJ é obrigatório e precisa ser válido.");
  if (input.color !== null && !/^#[0-9a-fA-F]{6}$/.test(input.color)) return fail("Cor inválida.");
  const dp = dataPatch({ ...input.data, closedValue: undefined, closedOn: undefined, isReactivation: input.data.isReactivation });
  if (dp.error) return fail(dp.error);
  const it = itemsSchema.safeParse(input.items ?? []);
  if (!it.success) return fail("Itens da cotação inválidos.");
  const items = it.data;
  const phone = input.phone.replace(/\D/g, "");
  if (phone && (phone.length < 10 || phone.length > 11)) return fail("Telefone com DDD (10 ou 11 dígitos).");

  let [lead] = await db.select().from(leads).where(eq(leads.cnpj, cnpj));
  const isNew = !lead;
  if (lead) {
    const [gone] = await db.execute<{ x: boolean }>(sql`select ${leftPortfolio(sql`${lead.id}`)} as x`);
    if (gone?.x) return fail("Este cliente já comprou em mês anterior e saiu da carteira (vendas futuras). Não dá para abrir nova negociação.");
    const [open] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.leadId, lead.id), sql`${deals.stage} not in ('ganho','perdido')`));
    if (open) return fail("Este cliente já tem uma negociação aberta. Abra-a na lista.");
  } else {
    const fallback = `CNPJ ${cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`;
    [lead] = await db.insert(leads).values({ cnpj, company: input.company.trim().slice(0, 200) || fallback, contactName: input.contactName.trim().slice(0, 120) || null, phones: phone ? [phone] : [], source: "vendedor" }).returning();
    await logAudit(db, { userId: me.id, leadId: lead.id, entity: "lead", action: "criou lead pela negociação", field: "Lead", newValue: lead.company });
    try {
      const r = await enrichLead(lead.id, me.id);
      if (r.info?.tradeName && lead.company.startsWith("CNPJ ")) await db.update(leads).set({ company: r.info.tradeName }).where(eq(leads.id, lead.id));
    } catch { /* sem internet/APIs: o cadastro fica só com o que foi digitado */ }
  }
  const leadId = lead.id;
  const seller = me.roles.includes("seller") ? me.id : null;
  const cents = dp.patch.valueCents ?? null;
  const note = input.note.trim().slice(0, 2000) || null;
  try {
    const id = await db.transaction(async (tx) => {
      if (!isNew) {
        const extra: Partial<typeof leads.$inferInsert> = {};
        if (input.contactName.trim() && !lead.contactName) extra.contactName = input.contactName.trim().slice(0, 120);
        if (phone && !lead.phones.includes(phone)) extra.phones = [...lead.phones, phone];
        if (Object.keys(extra).length) await tx.update(leads).set({ ...extra, updatedAt: new Date() }).where(eq(leads.id, leadId));
      }
      const [d] = await tx.insert(deals).values({
        leadId, sdrId: null, sellerId: seller, stage: cents ? "cotacao" : "contato", handoffNote: note, claimedAt: seller ? new Date() : null,
        lastContactAt: new Date(), quoteSentAt: cents ? new Date() : null, nextActionAt: cents ? new Date(Date.now() + ALERT_RULES.defaultFollowupDays * 86400_000) : null,
        nextActionNote: cents ? "Cobrar retorno da cotação" : null, color: input.color?.toLowerCase() ?? null, isTest: lead.isTest, ...dp.patch,
      }).returning({ id: deals.id });
      await tx.insert(dealEvents).values({ dealId: d.id, userId: me.id, kind: "criado", note: note ?? "Aberta pelo vendedor" });
      if (cents) await tx.insert(dealEvents).values({ dealId: d.id, userId: me.id, kind: "cotacao", valueCents: cents, note: dp.patch.quoteNumber ? `Cotação ${dp.patch.quoteNumber}` : null });
      if (items.length) await tx.insert(dealQuoteItems).values(items.map((i) => ({ ...i, dealId: d.id, quoteNumber: dp.patch.quoteNumber ?? null })));
      if (dp.patch.sapCode && lead.sapCode !== dp.patch.sapCode) await tx.update(leads).set({ sapCode: dp.patch.sapCode }).where(eq(leads.id, leadId));
      await setLeadTags(tx, { leadId, userId: me.id, add: [{ group: TAG.group.agenda, key: TAG.agendado }], reason: "Negociação aberta pelo vendedor" });
      await logAudit(tx, { userId: me.id, leadId, entity: "deal", action: "abriu negociação", field: "Negociação", newValue: isNew ? "novo lead" : "lead existente", meta: { negociacao: d.id, itens: items.length } });
      return d.id;
    });
    revalidatePath("/negociacoes"); revalidatePath("/painel"); revalidatePath("/leads");
    return { ok: true, message: "Negociação criada.", id };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return fail("Este cliente já tem uma negociação aberta.");
    throw e;
  }
}
