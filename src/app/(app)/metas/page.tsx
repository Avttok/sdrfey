import { CircleDollarSign, PhoneCall, Target } from "lucide-react";
import { panelCls } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { GoalBar } from "@/components/goal-bar";
import { GoalsForm } from "@/components/goals-form";
import { SellerGoalsForm } from "@/components/seller-goals-form";
import { attendanceSessions, db, leads, users, visits } from "@/db";
import { bubbleHex } from "@/config/theme";
import { isSellerOnly } from "@/config/roles";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";
import { effectiveSellerGoals } from "@/modules/settings/goals";

export const metadata: Metadata = { title: "Metas" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.metas");
  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const month = sql`(date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const s = await getSettings();
  const sellerOnly = isSellerOnly(me.roles);

  const sellers = await db.select().from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, sellerOnly ? eq(users.id, me.id) : undefined)).orderBy(asc(users.name));
  const sellerIds = sellers.map((u) => u.id);
  const [contactsToday, salesMonth] = sellerIds.length ? await Promise.all([
    db.execute<{ id: number; n: number }>(sql`select e.user_id as id, count(*)::int as n from deal_events e join deals d on d.id = e.deal_id where not d.is_test and e.kind in ('ligacao','whatsapp','email') and e.at >= ${today} and e.user_id in (${sql.join(sellerIds.map((i) => sql`${i}`), sql`, `)}) group by 1`),
    db.execute<{ id: number; n: number }>(sql`select d.seller_id as id, count(*)::int as n from deals d where d.stage = 'ganho' and not d.is_test and d.closed_at >= ${month} and d.seller_id in (${sql.join(sellerIds.map((i) => sql`${i}`), sql`, `)}) group by 1`),
  ]) : [[], []];
  const sellerPeople = sellers.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), contactsToday: contactsToday.find((d) => d.id === u.id)?.n ?? 0, salesMonth: salesMonth.find((d) => d.id === u.id)?.n ?? 0, ownContacts: u.sellerGoalContacts, ownSales: u.sellerGoalSales }));

  if (sellerOnly) {
    const g = effectiveSellerGoals(me as never, s);
    const mine = sellerPeople[0];
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHead icon={Target} title="Metas" subtitle="Seus contatos de hoje e as vendas do mês." />
        <div className="grid gap-4 sm:grid-cols-2">
          <section className={`${panelCls} space-y-4 p-6`}>
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><PhoneCall size={16} aria-hidden /></span>Contatos de hoje</h2>
            <GoalBar label="Contatos hoje" value={mine?.contactsToday ?? 0} qty={g.contactsPerDay} />
            <p className="text-xs text-muted">Conta cada ligação, WhatsApp e e-mail registrado nas suas negociações.</p>
          </section>
          <section className={`${panelCls} space-y-4 p-6`}>
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><CircleDollarSign size={16} aria-hidden /></span>Vendas do mês</h2>
            <GoalBar label="Vendas no mês" value={mine?.salesMonth ?? 0} qty={g.salesPerMonth} alt />
            <p className="text-xs text-muted">Negociações que você fechou como venda neste mês.</p>
          </section>
        </div>
        {me.permissions["goals.edit"] && <SellerGoalsForm canEdit global={{ contacts: s.seller_goal_contacts, sales: s.seller_goal_sales }} people={sellerPeople} />}
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
      <div className="mx-auto max-w-5xl"><SellerGoalsForm canEdit={!!me.permissions["goals.edit"]} global={{ contacts: s.seller_goal_contacts, sales: s.seller_goal_sales }} people={sellerPeople} /></div>
    </div>
  );
}
