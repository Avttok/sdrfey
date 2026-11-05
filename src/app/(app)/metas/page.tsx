import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { GoalsForm } from "@/components/goals-form";
import { attendanceSessions, db, leads, users, visits } from "@/db";
import { bubbleHex } from "@/config/theme";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = { title: "Metas" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.metas");
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const [s, list, done, sched] = await Promise.all([
    getSettings(),
    db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true))).orderBy(asc(users.name)),
    db.select({ id: attendanceSessions.userId, n: sql<number>`count(*)::int` }).from(attendanceSessions)
      .where(sql`${attendanceSessions.outcome} = 'saved' and not ${attendanceSessions.isTest} and ${attendanceSessions.savedAt} >= ${today}`).groupBy(attendanceSessions.userId),
    db.select({ id: visits.userId, n: sql<number>`count(*)::int` }).from(visits).innerJoin(leads, eq(leads.id, visits.leadId))
      .where(sql`${visits.canceledAt} is null and not ${leads.isTest} and ${visits.createdAt} >= ${today}`).groupBy(visits.userId),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="display text-3xl">Metas</h1>
      <GoalsForm
        canEdit={!!me.permissions["goals.edit"]}
        global={{ attended: { on: s.goal_attended_on === 1, qty: s.daily_goal }, scheduled: { on: s.goal_scheduled_on === 1, qty: s.daily_goal_scheduled } }}
        people={list.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), today: { attended: done.find((d) => d.id === u.id)?.n ?? 0, scheduled: sched.find((d) => d.id === u.id)?.n ?? 0 }, own: { attended: { on: u.goalAttendedOn, qty: u.dailyGoal }, scheduled: { on: u.goalScheduledOn, qty: u.dailyGoalScheduled } } }))}
      />
    </div>
  );
}
