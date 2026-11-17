import { visibleUsers } from "@/modules/auth/visibility";
import type { Metadata } from "next";
import { Play, Shuffle } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { GoalBar } from "@/components/goal-bar";
import { SubmitButton } from "@/components/submit-button";
import { panelCls } from "@/components/ui";
import { attendanceSessions, db, leads, users, visits } from "@/db";
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
    db.select({ n: sql<number>`((select count(*) from visits v where v.user_id = ${me.id} and v.canceled_at is null and v.created_at >= ${today}) + (select count(*) from deals d where d.sdr_id = ${me.id} and not d.is_test and d.created_at >= ${today}))::int` }).from(sql`(select 1) x`),
  ]);
  const goals = effectiveGoals(me, settings);

  if (!lead) {
    return (
      <div className={`${panelCls} relative mx-auto max-w-3xl overflow-hidden p-8 text-center sm:p-12`}>
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative space-y-6">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-grad text-on-accent shadow-lg shadow-accent/30"><Shuffle size={30} aria-hidden /></span>
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

  const [catalog, templates, sellers] = await Promise.all([getTagCatalog(), getActiveTemplates(), db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, visibleUsers(me))).orderBy(users.name)]);
  const [prev] = await db.execute<{ at: Date; name: string | null; channels: string[] | null; note: string | null }>(sql`
    select s.saved_at as at, u.name, l.notes as note,
      (select array_agg(distinct i.channel) from interactions i where i.lead_id = s.lead_id and i.user_id = s.user_id and i.at between coalesce(s.started_at, s.shown_at) and s.saved_at + interval '2 minutes') as channels
    from attendance_sessions s join leads l on l.id = s.lead_id left join users u on u.id = s.user_id
    where s.lead_id = ${lead.id} and s.outcome = 'saved' and not s.is_test and s.saved_at is not null and exists (select 1 from interactions x where x.lead_id = s.lead_id)
    order by s.saved_at desc limit 1`);
  const previous = prev ? { by: prev.name ?? "Outra pessoa", at: new Date(prev.at).toISOString(), channels: prev.channels ?? [], note: prev.note } : null;
  return <AttendFlow lead={lead} catalog={catalog} templates={templates} myName={me.name} showMap={me.mapMode === "map"} previous={previous} doneToday={done?.n ?? 0} scheduledToday={sched?.n ?? 0} goals={goals} sellers={sellers} />;
}
