import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isSellerOnly } from "@/config/roles";
import type { CurrentUser } from "@/modules/auth/guard";
import { SDR_KINDS, effectiveGoals, type GoalKind } from "@/modules/settings/goals";
import type { getSettings } from "@/modules/settings/get";

export type GoldStatus = { reached: boolean; label: string; done: number; qty: number };
const NONE: GoldStatus = { reached: false, label: "", done: 0, qty: 0 };

/**
 * O dia está dourado quando a pessoa bateu TODAS as metas ligadas dela (as do Adm, globais ou individuais).
 * Vendedor: vale o que ele trabalha no Shuffler Vendas. Uma consulta por meta ligada, em paralelo.
 */
export async function goldStatus(me: CurrentUser, settings: Awaited<ReturnType<typeof getSettings>>): Promise<GoldStatus> {
  const goals = effectiveGoals(me, settings);
  const kinds = SDR_KINDS.map((d) => d.k).filter((k) => goals[k].on && goals[k].qty > 0) as GoalKind[];
  if (!kinds.length) return NONE;
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const seller = isSellerOnly(me.roles);
  const query = (k: GoalKind) => ({
    attended: seller
      ? sql`select count(*)::int as n from seller_shuffles where user_id = ${me.id} and not is_test and done_at >= ${today}`
      : sql`select count(*)::int as n from attendance_sessions where user_id = ${me.id} and outcome = 'saved' and not is_test and saved_at >= ${today}`,
    scheduled: sql`select ((select count(*) from visits v where v.user_id = ${me.id} and v.canceled_at is null and v.created_at >= ${today}) + (select count(*) from deals d where d.sdr_id = ${me.id} and not d.is_test and d.created_at >= ${today}))::int as n`,
    calls: sql`select count(*)::int as n from interactions where user_id = ${me.id} and not is_test and channel = 'ligacao' and at >= ${today}`,
    converted: sql`select count(*)::int as n from deals where sdr_id = ${me.id} and not is_test and created_at >= ${today}`,
  }[k]);
  const counts = await Promise.all(kinds.map(async (k) => (await db.execute<{ n: number }>(query(k)))[0]?.n ?? 0));
  const done = kinds.filter((k, i) => counts[i] >= goals[k].qty).length;
  return { reached: done === kinds.length, label: kinds.length === 1 ? SDR_KINDS.find((d) => d.k === kinds[0])!.label : "todas as metas do dia", done, qty: kinds.length };
}
