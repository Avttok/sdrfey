import { and, eq, sql } from "drizzle-orm";
import { db, dealEvents, deals, settings, users, type Db } from "@/db";
import { getSettings } from "@/modules/settings/get";
import { logAudit, type DbOrTx } from "@/modules/audit/log";
import { leftPortfolio } from "./portfolio";
import { UserError } from "@/modules/leads/sorter";

type Tx = DbOrTx | Db;

/** Vendedores que entram na fila de distribuição, na ordem fixa (por id). */
async function queueSellers(tx: Tx): Promise<number[]> {
  const rows = await tx.select({ id: users.id }).from(users).where(and(eq(users.active, true), eq(users.inMetrics, true), sql`'seller' = any(${users.roles})`)).orderBy(users.id);
  return rows.map((r) => r.id);
}
async function cursor(tx: Tx): Promise<number> {
  const [r] = await tx.select({ v: settings.value }).from(settings).where(eq(settings.key, "seller_queue_last"));
  return Number(r?.v ?? 0) || 0;
}
/** Quem é o próximo da fila (sem avançar). */
export async function peekNextSeller(tx: Tx = db): Promise<number | null> {
  const list = await queueSellers(tx);
  if (!list.length) return null;
  const last = await cursor(tx);
  return list.find((id) => id > last) ?? list[0];
}
/** Pega o próximo da vez e avança a fila (travado para dois SDRs não receberem o mesmo vendedor). */
async function takeNextSeller(tx: Tx): Promise<number | null> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('seller_queue'))`);
  const next = await peekNextSeller(tx);
  if (next) await tx.insert(settings).values({ key: "seller_queue_last", value: next }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
  return next;
}

/**
 * Repasse do SDR para os vendedores: cria a negociação na hora (vendedor liga e fecha, não há espera).
 * Sem `sellerId`, com a fila ligada, vai para o próximo vendedor da vez; sem fila cai no grupo e o primeiro a clicar em "Assumir" fica com ela.
 */
export async function createDealTx(tx: Tx, o: { leadId: number; sdrId: number; sellerId?: number | null; note?: string | null; isTest: boolean }): Promise<number> {
  let sellerId: number | null = null;
  let viaQueue = false;
  if (o.sellerId) {
    const [s] = await tx.select({ id: users.id, roles: users.roles, active: users.active }).from(users).where(eq(users.id, o.sellerId));
    if (!s || !s.active || !s.roles.includes("seller")) throw new UserError("Vendedor inválido.");
    sellerId = s.id;
  } else if (!o.isTest && (await getSettings()).seller_queue_on === 1) {
    sellerId = await takeNextSeller(tx); // fila: 1, 2, 3, 4, 1, 2…
    viaQueue = true;
  }
  const [gone] = await tx.execute<{ x: boolean }>(sql`select ${leftPortfolio(sql`${o.leadId}`)} as x`);
  if (gone?.x) throw new UserError("Este cliente já comprou em mês anterior e saiu da carteira (vendas futuras). Não é possível abrir nova negociação.");
  const open = await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.leadId, o.leadId), sql`${deals.stage} not in ('ganho','perdido')`));
  if (open.length) throw new UserError("Este lead já está em negociação com os vendedores.");
  const note = o.note?.trim() || null;
  const [d] = await tx.insert(deals).values({ leadId: o.leadId, sdrId: o.sdrId, sellerId, handoffNote: note, claimedAt: sellerId ? new Date() : null, isTest: o.isTest }).returning({ id: deals.id });
  await tx.insert(dealEvents).values({ dealId: d.id, userId: o.sdrId, kind: "criado", note });
  await logAudit(tx, { userId: o.sdrId, leadId: o.leadId, entity: "deal", action: "repassou para vendedores", field: "Negociação", newValue: sellerId ? (viaQueue ? "próximo da fila" : "vendedor escolhido") : "grupo dos vendedores", meta: { negociacao: d.id, vendedor: sellerId } });
  return d.id;
}
