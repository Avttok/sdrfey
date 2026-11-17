import { and, eq, sql } from "drizzle-orm";
import { dealEvents, deals, users, type Db } from "@/db";
import { logAudit, type DbOrTx } from "@/modules/audit/log";
import { leftPortfolio } from "./portfolio";
import { UserError } from "@/modules/leads/sorter";

type Tx = DbOrTx | Db;

/**
 * Repasse do SDR para os vendedores: cria a negociação na hora (vendedor liga e fecha, não há espera).
 * Sem `sellerId` ela cai no grupo e o primeiro vendedor que clicar em "Assumir" fica com ela.
 */
export async function createDealTx(tx: Tx, o: { leadId: number; sdrId: number; sellerId?: number | null; note?: string | null; isTest: boolean }): Promise<number> {
  let sellerId: number | null = null;
  if (o.sellerId) {
    const [s] = await tx.select({ id: users.id, roles: users.roles, active: users.active }).from(users).where(eq(users.id, o.sellerId));
    if (!s || !s.active || !s.roles.includes("seller")) throw new UserError("Vendedor inválido.");
    sellerId = s.id;
  }
  const [gone] = await tx.execute<{ x: boolean }>(sql`select ${leftPortfolio(sql`${o.leadId}`)} as x`);
  if (gone?.x) throw new UserError("Este cliente já comprou em mês anterior e saiu da carteira (vendas futuras). Não é possível abrir nova negociação.");
  const open = await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.leadId, o.leadId), sql`${deals.stage} not in ('ganho','perdido')`));
  if (open.length) throw new UserError("Este lead já está em negociação com os vendedores.");
  const note = o.note?.trim() || null;
  const [d] = await tx.insert(deals).values({ leadId: o.leadId, sdrId: o.sdrId, sellerId, handoffNote: note, claimedAt: sellerId ? new Date() : null, isTest: o.isTest }).returning({ id: deals.id });
  await tx.insert(dealEvents).values({ dealId: d.id, userId: o.sdrId, kind: "criado", note });
  await logAudit(tx, { userId: o.sdrId, leadId: o.leadId, entity: "deal", action: "repassou para vendedores", field: "Negociação", newValue: sellerId ? "vendedor escolhido" : "grupo dos vendedores", meta: { negociacao: d.id, vendedor: sellerId } });
  return d.id;
}
