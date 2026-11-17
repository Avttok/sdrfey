import { Target } from "lucide-react";
import { PageHead } from "@/components/page-head";
import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { GoalsForm } from "@/components/goals-form";
import { SellerGoalsForm } from "@/components/seller-goals-form";
import { attendanceSessions, db, leads, users, visits } from "@/db";
import { bubbleHex } from "@/config/theme";
import { isSellerOnly } from "@/config/roles";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";
import { getSellerGoalSettings, getSellerMonth } from "@/modules/deals/goals";
import { SellerGoalPanel } from "@/components/deals/seller-goal-panel";
import { attainment, resolveSellerGoals, SELLER_METRICS } from "@/config/seller-goals";

export const metadata: Metadata = { title: "Metas" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.metas");
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const month = sql`(date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const s = await getSettings();
  const sellerOnly = isSellerOnly(me.roles);

  const sellers = await db.select().from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, sellerOnly ? eq(users.id, me.id) : undefined)).orderBy(asc(users.name));
  const gset = await getSellerGoalSettings();
  const views = await Promise.all(sellers.map(async (u) => {
    const m = await getSellerMonth(u.id);
    const { targets, weights } = resolveSellerGoals(gset, u.sellerGoals ?? {});
    return { u, m, targets, weights, overall: attainment(m.actual, targets, weights).overall };
  }));
  const globalVals = Object.fromEntries(SELLER_METRICS.flatMap((m) => [[m.key, gset[m.key] ?? m.target], [`w_${m.key}`, gset[`w_${m.key}`] ?? m.weight]])) as Record<string, number>;
  const sellerPeople = views.map(({ u, overall }) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), own: (u.sellerGoals ?? {}) as Record<string, number>, overall }));

  if (sellerOnly) {
    const v = views[0];
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHead icon={Target} title="Metas" subtitle="Suas metas do mês, com o peso de cada uma." />
        {v && <SellerGoalPanel actual={v.m.actual} targets={v.targets} weights={v.weights} bonusReais={v.m.bonusReais} bonusSales={v.m.bonusSales} monthLabel={v.m.monthLabel} />}
      </div>
    );
  }

  const [list, done, sched] = await Promise.all([
    db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true), sql`not (${users.roles} = array['seller']::text[])`)).orderBy(asc(users.name)),
    db.select({ id: attendanceSessions.userId, n: sql<number>`count(*)::int` }).from(attendanceSessions)
      .where(sql`${attendanceSessions.outcome} = 'saved' and not ${attendanceSessions.isTest} and ${attendanceSessions.savedAt} >= ${today}`).groupBy(attendanceSessions.userId),
    db.execute<{ id: number; n: number }>(sql`select u as id, count(*)::int as n from (
        select v.user_id as u from visits v join leads l on l.id = v.lead_id where v.canceled_at is null and not l.is_test and v.created_at >= ${today}
        union all select d.sdr_id from deals d where not d.is_test and d.created_at >= ${today}) x group by u`),
  ]);
  void leads; void visits;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHead icon={Target} title="Metas" subtitle="Metas diárias de atendimentos e agendamentos (SDR) e de vendas (vendedores), globais ou por pessoa." />
      <GoalsForm
        canEdit={!!me.permissions["goals.edit"]}
        global={{ attended: { on: s.goal_attended_on === 1, qty: s.daily_goal }, scheduled: { on: s.goal_scheduled_on === 1, qty: s.daily_goal_scheduled } }}
        people={list.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), today: { attended: done.find((d) => d.id === u.id)?.n ?? 0, scheduled: sched.find((d) => d.id === u.id)?.n ?? 0 }, own: { attended: { on: u.goalAttendedOn, qty: u.dailyGoal }, scheduled: { on: u.goalScheduledOn, qty: u.dailyGoalScheduled } } }))}
      />
      <div className="mx-auto max-w-5xl"><SellerGoalsForm canEdit={!!me.permissions["goals.edit"]} global={globalVals} people={sellerPeople} /></div>
    </div>
  );
}
