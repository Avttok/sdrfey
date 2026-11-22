import { visibleUsers } from "@/modules/auth/visibility";
import { hasAvailable, releaseExpiredLocks } from "@/modules/leads/sorter";
import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { GoalTiles } from "@/components/goal-tiles";
import { ShuffleHero } from "@/components/shuffle-hero";
import { attendanceSessions, db, leads, users, visits } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { startAction } from "@/modules/leads/actions";
import { peekNextSeller } from "@/modules/deals/handoff";
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
    const available = await hasAvailable(me.id);
    return (
      <ShuffleHero avatar={me.avatar} roles={me.shownRoles} action={startAction} empty={available ? undefined : { hint: "Todos os leads já foram trabalhados, estão com outra pessoa ou aguardando a hora de voltar. Avise o time e confira de novo daqui a pouco." }}>
        <GoalTiles items={[
          ...(goals.attended.on ? [{ k: "attended" as const, label: "Atendidos", value: done?.n ?? 0, qty: goals.attended.qty }] : []),
          ...(goals.scheduled.on ? [{ k: "scheduled" as const, label: "Agendados", value: sched?.n ?? 0, qty: goals.scheduled.qty }] : []),
          ...(goals.calls.on ? [{ k: "calls" as const, label: "Ligações", value: extra.calls, qty: goals.calls.qty }] : []),
          ...(goals.converted.on ? [{ k: "converted" as const, label: "Convertidos", value: extra.converted, qty: goals.converted.qty }] : []),
        ]} />
      </ShuffleHero>
    );
  }

  const previous = prev ? { by: prev.name ?? "Outra pessoa", at: new Date(prev.at).toISOString(), channels: prev.channels ?? [], note: prev.note } : null;
  return <AttendFlow autoEnrichOn={(await getSettings()).auto_enrich === 1} lead={lead} catalog={catalog!} templates={templates} myName={me.name} showMap={me.mapMode === "map"} previous={previous} doneToday={done?.n ?? 0} scheduledToday={sched?.n ?? 0} goals={goals} sellers={sellers} queue={{ on: settings.seller_queue_on === 1, nextId: await peekNextSeller() }} />;
}
