import type { Metadata } from "next";
import { Play, Shuffle } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { GoalBar } from "@/components/goal-bar";
import { SubmitButton } from "@/components/submit-button";
import { panelCls } from "@/components/ui";
import { attendanceSessions, db, leads, visits } from "@/db";
import { plural } from "@/lib/format";
import { requirePerm } from "@/modules/auth/guard";
import { startAction } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";
import { getActiveTemplates, getLeadView, getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Shuffler" };
export const dynamic = "force-dynamic";

export default async function AttendPage() {
  const me = await requirePerm("tab.comecar");
  const [mine] = await db.select({ id: leads.id }).from(leads).where(eq(leads.lockedBy, me.id)).limit(1);
  const lead = mine ? await getLeadView(mine.id) : null;
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const [settings, [done], [sched]] = await Promise.all([
    getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(attendanceSessions).where(and(eq(attendanceSessions.userId, me.id), eq(attendanceSessions.outcome, "saved"), eq(attendanceSessions.isTest, false), sql`${attendanceSessions.savedAt} >= ${today}`)),
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(and(eq(visits.userId, me.id), sql`${visits.canceledAt} is null`, sql`${visits.createdAt} >= ${today}`)),
  ]);
  const goals = effectiveGoals(me, settings);

  if (!lead) {
    return (
      <div className={`${panelCls} relative mx-auto max-w-3xl overflow-hidden p-8 text-center sm:p-12`}>
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative space-y-6">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-on-accent shadow-lg shadow-accent/30"><Shuffle size={30} aria-hidden /></span>
          <div>
            <h1 className="display text-3xl sm:text-4xl">Pronto para o próximo lead?</h1>
            <p className="mx-auto mt-2 max-w-md text-muted">O sistema escolhe um lead livre para você. Se quiser um específico, use ATENDER na aba Leads ou no seu histórico.</p>
          </div>
          {(goals.attended.on || goals.scheduled.on) && (
            <div className="mx-auto grid max-w-sm gap-4 text-left">
              {goals.attended.on && <GoalBar label="Atendidos hoje" value={done?.n ?? 0} qty={goals.attended.qty} />}
              {goals.scheduled.on && <GoalBar label="Agendados hoje" value={sched?.n ?? 0} qty={goals.scheduled.qty} alt />}
            </div>
          )}
          {!goals.attended.on && !goals.scheduled.on && <p className="text-sm text-muted">Hoje: <b className="figure text-ink">{done?.n ?? 0}</b> {plural(done?.n ?? 0, "atendido", "atendidos")} · <b className="figure text-ink">{sched?.n ?? 0}</b> {plural(sched?.n ?? 0, "agendado", "agendados")}</p>}
          <form action={startAction}>
            <SubmitButton><Play size={18} aria-hidden /> Shuffler</SubmitButton>
          </form>
        </div>
      </div>
    );
  }

  const [catalog, templates] = await Promise.all([getTagCatalog(), getActiveTemplates()]);
  return <AttendFlow lead={lead} catalog={catalog} templates={templates} myName={me.name} doneToday={done?.n ?? 0} scheduledToday={sched?.n ?? 0} goals={goals} />;
}
