"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dealEvents, deals, leads, sellerShuffles, db } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { logAudit } from "@/modules/audit/log";
import type { ActionResult } from "@/modules/leads/actions";
import { leftPortfolio } from "@/modules/deals/portfolio";
import { claimInactive, claimInactiveLead } from "./shuffler";
import { saveSalesWork, type SalesFinal } from "./save";
import type { SaveInput } from "@/modules/leads/attend";
import { UserError } from "@/modules/leads/sorter";

const fail = (message: string): ActionResult => ({ ok: false, message });

/** "Iniciar": sorteia o próximo lead inativo (ou volta ao que já está em mãos). */
export async function startSalesShuffleAction() {
  const me = await requirePerm("tab.shuffler_vendas");
  await claimInactive(me.id);
  revalidatePath("/shuffler-vendas");
  redirect("/shuffler-vendas");
}

/** "Atender" num lead inativo da lista: o vendedor puxa esse lead para o Shuffler Vendas. */
export async function attendInactiveAction(leadId: number): Promise<ActionResult> {
  const me = await requirePerm("tab.shuffler_vendas");
  if (!Number.isInteger(leadId)) return fail("Pedido inválido.");
  try { await claimInactiveLead(me.id, leadId); } catch (e) { return fail(e instanceof Error ? e.message : "Não foi possível atender."); }
  revalidatePath("/shuffler-vendas");
  redirect("/shuffler-vendas");
}

/** Encerra a passagem atual sem negociação: sem contato, sem interesse ou pular. */
export async function finishSalesShuffleAction(id: number, outcome: "no_answer" | "no_interest" | "skipped" | "released", note: string): Promise<ActionResult> {
  const me = await requirePerm("tab.shuffler_vendas");
  const p = z.object({ outcome: z.enum(["no_answer", "no_interest", "skipped", "released"]), note: z.string().trim().max(1000) }).safeParse({ outcome, note });
  if (!p.success) return fail("Confira os campos.");
  const [s] = await db.update(sellerShuffles).set({ outcome: p.data.outcome, note: p.data.note || null, doneAt: new Date() })
    .where(and(eq(sellerShuffles.id, id), eq(sellerShuffles.userId, me.id), sql`${sellerShuffles.outcome} is null`)).returning({ leadId: sellerShuffles.leadId });
  if (!s) return fail("Este lead não está mais com você.");
  await db.update(leads).set({ lockedBy: null, lockedAt: null }).where(and(eq(leads.id, s.leadId), eq(leads.lockedBy, me.id)));
  await logAudit(db, { userId: me.id, leadId: s.leadId, entity: "lead", action: "trabalhou lead inativo", field: "Shuffler Vendas", newValue: p.data.outcome, meta: { nota: p.data.note || null } });
  revalidatePath("/shuffler-vendas");
  return { ok: true };
}

/** Abre a negociação com o lead inativo sorteado e leva o vendedor para ela. */
export async function openDealFromShuffleAction(id: number, note: string): Promise<ActionResult & { dealId?: number }> {
  const me = await requirePerm("tab.shuffler_vendas");
  const [s] = await db.select().from(sellerShuffles).where(and(eq(sellerShuffles.id, id), eq(sellerShuffles.userId, me.id), sql`${sellerShuffles.outcome} is null`));
  if (!s) return fail("Este lead não está mais com você.");
  const [lead] = await db.select().from(leads).where(eq(leads.id, s.leadId));
  if (!lead) return fail("Lead não encontrado.");
  const [gone] = await db.execute<{ x: boolean }>(sql`select ${leftPortfolio(sql`${lead.id}`)} as x`);
  if (gone?.x) return fail("Este cliente já comprou em mês anterior e saiu da carteira.");
  const [open] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.leadId, lead.id), sql`${deals.stage} not in ('ganho','perdido')`));
  if (open) return fail("Este cliente já tem uma negociação aberta.");
  const text = note.trim().slice(0, 2000) || null;
  const dealId = await db.transaction(async (tx) => {
    const [d] = await tx.insert(deals).values({ leadId: lead.id, sdrId: null, sellerId: me.id, stage: "contato", claimedAt: new Date(), lastContactAt: new Date(), handoffNote: text, isTest: lead.isTest }).returning({ id: deals.id });
    await tx.insert(dealEvents).values({ dealId: d.id, userId: me.id, kind: "criado", note: text ?? "Aberta pelo Shuffler Vendas" });
    await tx.update(sellerShuffles).set({ outcome: "deal", dealId: d.id, doneAt: new Date(), note: text }).where(eq(sellerShuffles.id, id));
    await tx.update(leads).set({ lockedBy: null, lockedAt: null }).where(and(eq(leads.id, lead.id), eq(leads.lockedBy, me.id)));
    await logAudit(tx, { userId: me.id, leadId: lead.id, entity: "deal", action: "abriu negociação", field: "Negociação", newValue: "lead inativo", meta: { negociacao: d.id } });
    return d.id;
  });
  revalidatePath("/negociacoes"); revalidatePath("/shuffler-vendas"); revalidatePath("/painel");
  return { ok: true, dealId };
}

/** Fim da passagem no fluxo completo (igual ao do SDR): só salvar, agendar visita + abrir no meu painel Novo, ou devolver à fila dos SDR. */
export async function saveSalesShuffleAction(id: number, input: SaveInput, final: SalesFinal): Promise<ActionResult> {
  const me = await requirePerm("tab.shuffler_vendas");
  try {
    await saveSalesWork(me.id, id, input, final);
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    console.error(e);
    return fail("Algo deu errado. Tente de novo; se repetir, avise o Adm.");
  }
  revalidatePath("/shuffler-vendas"); revalidatePath("/negociacoes"); revalidatePath("/painel"); revalidatePath("/visitas");
  return { ok: true, message: final === "visit" ? "Visita agendada e negociação aberta no seu painel Novo." : final === "sdr" ? "Devolvido à fila dos SDR." : "Salvo." };
}
