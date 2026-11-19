import { and, eq, sql } from "drizzle-orm";
import { attendanceSessions, db } from "@/db";
import type { CurrentUser } from "@/modules/auth/guard";
import { achievementsOf } from "@/modules/achievements/stats";
import { coinBalance, syncCoins } from "@/modules/coins/coins";
import { getSettings } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";

/** Dados do "Meu dia" no topo do Dashboard: metas de hoje, conquistas, moedas e andamento das vendas. */
export async function getHero(me: CurrentUser) {
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const month = sql`(date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const isSdr = me.roles.some((r) => r !== "seller");
  const isSeller = me.roles.some((r) => r === "seller" || r === "manager" || r === "admin");
  await syncCoins(me.id, me.shownRoles);
  const [coins, ach, settings, [att], [sold]] = await Promise.all([
    coinBalance(me.id),
    achievementsOf(me.id, me.shownRoles),
    getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(attendanceSessions).where(and(eq(attendanceSessions.userId, me.id), eq(attendanceSessions.outcome, "saved"), eq(attendanceSessions.isTest, false), sql`${attendanceSessions.savedAt} >= ${today}`)),
    db.execute<{ open: number; billed: number; billed_cents: number; inactive: number }>(sql`select
      (select count(*) from deals where seller_id = ${me.id} and not is_test and stage not in ('ganho','perdido'))::int as open,
      (select count(*) from deals where seller_id = ${me.id} and not is_test and stage = 'ganho' and coalesce(closed_on::timestamptz, closed_at) >= ${month})::int as billed,
      (select coalesce(sum(coalesce(real_value_cents, net_value_cents, closed_value_cents, value_cents, 0)), 0) from deals where seller_id = ${me.id} and not is_test and stage = 'ganho' and coalesce(closed_on::timestamptz, closed_at) >= ${month})::bigint as billed_cents,
      (select count(*) from leads where kind = 'inativo')::int as inactive`),
  ]);
  const goals = effectiveGoals(me, settings);
  const earned = ach.list.filter((a) => a.earned).length;
  const next = ach.list.filter((a) => !a.earned).map((a) => ({ key: a.key, name: a.name, desc: a.desc, ratio: a.goal ? Math.min(1, a.value / a.goal) : 0, value: a.value, goal: a.goal })).sort((a, b) => b.ratio - a.ratio)[0] ?? null;
  return {
    isSdr, isSeller, coins, earned, total: ach.list.length, next,
    attended: att?.n ?? 0, attendedGoal: goals.attended.on ? goals.attended.qty : 0,
    open: sold?.open ?? 0, billed: sold?.billed ?? 0, billedCents: Number(sold?.billed_cents ?? 0), inactive: sold?.inactive ?? 0,
  };
}
export type Hero = Awaited<ReturnType<typeof getHero>>;
