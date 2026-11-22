import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isSellerOnly } from "@/config/roles";
import type { CurrentUser } from "@/modules/auth/guard";
import { SDR_KINDS, effectiveGoals, type GoalKind } from "@/modules/settings/goals";
import type { getSettings } from "@/modules/settings/get";

export type GoldStatus = { reached: boolean; label: string; done: number; qty: number };
const NONE: GoldStatus = { reached: false, label: "", done: 0, qty: 0 };

/**
 * A meta do dia está batida? Vale a meta principal: "Atendidos" se estiver ligada (vendedor: leads trabalhados no Shuffler de vendas),
 * senão a primeira meta ligada. Uma consulta só.
 */
export async function goldStatus(me: CurrentUser, settings: Awaited<ReturnType<typeof getSettings>>): Promise<GoldStatus> {
  const goals = effectiveGoals(me, settings);
  const main = (goals.attended.on ? "attended" : SDR_KINDS.find((d) => goals[d.k].on)?.k) as GoalKind | undefined;
  if (!main || goals[main].qty <= 0) return NONE;
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const seller = isSellerOnly(me.roles);
  const q = {
    attended: seller
      ? sql`select count(*)::int as n from seller_shuffles where user_id = ${me.id} and not is_test and done_at >= ${today}`
      : sql`select count(*)::int as n from attendance_sessions where user_id = ${me.id} and outcome = 'saved' and not is_test and saved_at >= ${today}`,
    scheduled: sql`select ((select count(*) from visits v where v.user_id = ${me.id} and v.canceled_at is null and v.created_at >= ${today}) + (select count(*) from deals d where d.sdr_id = ${me.id} and not d.is_test and d.created_at >= ${today}))::int as n`,
    calls: sql`select count(*)::int as n from interactions where user_id = ${me.id} and not is_test and channel = 'ligacao' and at >= ${today}`,
    converted: sql`select count(*)::int as n from deals where sdr_id = ${me.id} and not is_test and created_at >= ${today}`,
  }[main];
  const [r] = await db.execute<{ n: number }>(q);
  const done = r?.n ?? 0;
  return { reached: done >= goals[main].qty, label: SDR_KINDS.find((d) => d.k === main)!.label, done, qty: goals[main].qty };
}
