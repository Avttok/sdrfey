import { visibleUsers } from "@/modules/auth/visibility";
import { releaseExpiredLocks } from "@/modules/leads/sorter";
import type { Metadata } from "next";
import { Play, Shuffle } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { GoalTiles } from "@/components/goal-tiles";
import { SubmitButton } from "@/components/submit-button";
import { panelCls } from "@/components/ui";
import { attendanceSessions, db, leads, users, visits } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { startAction } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";
import { getActiveTemplates, getLeadView, getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Shuffler" };
export const dynamic = "force-dynamic";

export default async function AttendPage() {
  const me = await requirePerm("tab.comecar");
  await releaseExpiredLocks(); // lead parado além do prazo volta ao estoque antes de decidir qual tela mostrar
  const [mine] = await db.select({ id: leads.id }).from(leads).where(eq(leads.lockedBy, me.id)).limit(1);
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  // tudo que não depende de outra consulta roda junto (cada ida ao banco custa tempo de rede)
  const leadId = mine?.id ?? -1;
  const [lead, settings, [done], [sched], catalog, templates, sellers, [prev]] = await Promise.all([
    mine ? getLeadView(mine.id) : Promise.resolve(null),
    getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(attendanceSessions).where(and(eq(attendanceSessions.userId, me.id), eq(attendanceSessions.outcome, "saved"), eq(attendanceSessions.isTest, false), sql`${attendanceSessions.savedAt} >= ${today}`)),
    db.select({ n: sql<number>`((select count(*) from visits v where v.user_id = ${me.id} and v.canceled_at is null and v.created_at >= ${today}) + (select count(*) from deals d where d.sdr_id = ${me.id} and not d.is_test and d.created_at >= ${today}))::int` }).from(sql`(select 1) x`),
    mine ? getTagCatalog() : Promise.resolve(null),
    mine ? getActiveTemplates() : Promise.resolve([]),
    mine ? db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, visibleUsers(me))).orderBy(users.name) : Promise.resolve([]),
    mine ? db.execute<{ at: Date; name: string | null; channels: string[] | null; note: string | null }>(sql`
    select s.saved_at as at, u.name, l.notes as note,
      (select array_agg(distinct i.channel) from interactions i where i.lead_id = s.lead_id and i.user_id = s.user_id and i.at between coalesce(s.started_at, s.shown_at) and s.saved_at + interval '2 minutes') as channels
    from attendance_sessions s join leads l on l.id = s.lead_id left join users u on u.id = s.user_id
    where s.lead_id = ${leadId} and s.outcome = 'saved' and not s.is_test and s.saved_at is not null and exists (select 1 from interactions x where x.lead_id = s.lead_id)
    order by s.saved_at desc limit 1`) : Promise.resolve([undefined]),
  ]);
  const goals = effectiveGoals(me, settings);
  const extra = { calls: 0, converted: 0 };
  if (goals.calls.on || goals.converted.on) {
    const [r] = await db.execute<{ calls: number; converted: number }>(sql`select
      (select count(*) from interactions i where i.user_id = ${me.id} and not i.is_test and i.channel = 'ligacao' and i.at >= ${today})::int as calls,
      (select count(*) from deals d where d.sdr_id = ${me.id} and not d.is_test and d.created_at >= ${today})::int as converted`);
    extra.calls = r?.calls ?? 0; extra.converted = r?.converted ?? 0;
  }

  if (!lead) {
    return (
      <>
      <div aria-hidden className="spawn-fade pointer-events-none fixed inset-0 -z-10" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 26%, var(--bg)) 0%, color-mix(in srgb, var(--accent) 7%, var(--bg)) 48%, color-mix(in srgb, var(--accent) 20%, var(--bg)) 100%)" }}>
        <div className="absolute -left-24 -top-24 size-[30rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 size-[34rem] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="spawn-in relative -my-3 grid flex-1 min-h-[22rem] place-items-center overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <div className="relative grid w-full max-w-6xl items-center gap-6 text-center md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] md:gap-8 md:text-left">
          <div className="space-y-3">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-grad text-on-accent shadow-xl shadow-accent/40 md:mx-0 md:size-16"><Shuffle size={28} aria-hidden /></span>
            <h1 className="display text-3xl lg:text-4xl">Pronto para o próximo lead?</h1>
            <p className="mx-auto max-w-md text-sm text-muted md:mx-0">O sistema escolhe um lead livre para você. Se quiser um específico, use ATENDER na aba Leads ou no seu histórico.</p>
          </div>
          <div className="mx-auto w-full">
            <GoalTiles items={[
              ...(goals.attended.on ? [{ k: "attended" as const, label: "Atendidos", value: done?.n ?? 0, qty: goals.attended.qty }] : []),
              ...(goals.scheduled.on ? [{ k: "scheduled" as const, label: "Agendados", value: sched?.n ?? 0, qty: goals.scheduled.qty }] : []),
              ...(goals.calls.on ? [{ k: "calls" as const, label: "Ligações", value: extra.calls, qty: goals.calls.qty }] : []),
              ...(goals.converted.on ? [{ k: "converted" as const, label: "Convertidos", value: extra.converted, qty: goals.converted.qty }] : []),
            ]} />
          </div>
          <form action={startAction} className="flex justify-center">
            <SubmitButton><Play size={18} aria-hidden /> Shuffler</SubmitButton>
          </form>
        </div>
      </div>
      </>
    );
  }

  const previous = prev ? { by: prev.name ?? "Outra pessoa", at: new Date(prev.at).toISOString(), channels: prev.channels ?? [], note: prev.note } : null;
  return <AttendFlow lead={lead} catalog={catalog!} templates={templates} myName={me.name} showMap={me.mapMode === "map"} previous={previous} doneToday={done?.n ?? 0} scheduledToday={sched?.n ?? 0} goals={goals} sellers={sellers} />;
}
