import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { GoalsForm } from "@/components/goals-form";
import { attendanceSessions, db, users } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = { title: "Metas" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.metas");
  const [s, list, done] = await Promise.all([
    getSettings(),
    db.select({ id: users.id, name: users.name, goal: users.dailyGoal }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    db.select({ id: attendanceSessions.userId, n: sql<number>`count(*)::int` }).from(attendanceSessions)
      .where(sql`${attendanceSessions.outcome} = 'saved' and not ${attendanceSessions.isTest} and ${attendanceSessions.savedAt} >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`).groupBy(attendanceSessions.userId),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="display text-3xl">Metas</h1>
      <GoalsForm global={s.daily_goal} canEdit={!!me.permissions["goals.edit"]} people={list.map((u) => ({ ...u, today: done.find((d) => d.id === u.id)?.n ?? 0 }))} />
    </div>
  );
}
