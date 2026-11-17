"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dealEvents, deals, leads, users, type DealStage } from "@/db";
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
export async function sendQuoteAction(id: number, input: { value: string; note: string; followupDays: number }): Promise<ActionResult> {
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (closed(deal.stage)) return fail("Esta negociação já foi encerrada.");
  const cents = parseMoneyToCents(input.value);
  if (cents === null || cents <= 0) return fail("Informe o valor da cotação (ex.: 12.500,00).");
  const days = Number.isInteger(input.followupDays) && input.followupDays >= 1 && input.followupDays <= 30 ? input.followupDays : ALERT_RULES.defaultFollowupDays;
  const next = new Date(Date.now() + days * 86400_000);
  const note = input.note.trim().slice(0, 2000) || null;
  await db.transaction(async (tx) => {
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

export async function closeDealAction(id: number, input: { won: boolean; value?: string; reason?: string }): Promise<ActionResult> {
  const r = await load(id);
  if ("error" in r) return fail(r.error);
  const { me, deal } = r;
  if (closed(deal.stage)) return fail("Esta negociação já foi encerrada.");
  let cents = deal.valueCents;
  if (input.won) {
    if (input.value?.trim()) { cents = parseMoneyToCents(input.value); if (cents === null) return fail("Valor da venda inválido."); }
    if (!cents) return fail("Informe o valor da venda.");
  } else if (!input.reason?.trim()) return fail("Conte o motivo da perda.");
  const reason = input.reason?.trim().slice(0, 500) || null;
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ stage: input.won ? "ganho" : "perdido", valueCents: input.won ? cents : deal.valueCents, lostReason: input.won ? null : reason, closedAt: new Date(), nextActionAt: null, nextActionNote: null, sellerId: deal.sellerId ?? me.id, updatedAt: new Date() }).where(eq(deals.id, id));
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
    await tx.update(deals).set({ stage: "contato", closedAt: null, lostReason: null, updatedAt: new Date() }).where(eq(deals.id, id));
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
