import { visibleUsers } from "@/modules/auth/visibility";
import { Handshake, Headset, Target } from "lucide-react";
import { MetasShell, type MetasTab } from "@/components/metas-shell";
import { SdrOverview } from "@/components/goals-overview";
import { panelCls } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { GoalsForm } from "@/components/goals-form";
import { SellerGoalsForm } from "@/components/seller-goals-form";
import { attendanceSessions, db, users } from "@/db";
import { bubbleHex } from "@/config/theme";
import { hasSdrPart, hasSellerPart } from "@/config/roles";
import { requirePerm } from "@/modules/auth/guard";
import { goalScope } from "@/modules/auth/goal-scope";
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
  const scope = goalScope(me.permissions);
  const canGlobal = scope === "all";
  const editableIds = scope === "own" ? [me.id] : [];
  /** Vê a equipe toda: Adm, "ver números da equipe" ou quem altera metas da equipe. Sem isso, só a própria linha. */
  const viewAll = me.roles.includes("admin") || !!me.permissions["panel.equipe"] || canGlobal;

  const hasSeller = hasSellerPart(me.roles);
  const showSdr = hasSdrPart(me.roles);
  const showSellers = hasSeller || viewAll;
  /** Gestão/Adm: vê e (com permissão) altera as metas da equipe. Os demais só veem o que é deles. */
  const manage = viewAll;
  const onlySelf = !viewAll;

  const sellers = showSellers ? await db.select().from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, onlySelf ? eq(users.id, me.id) : undefined, visibleUsers(me))).orderBy(asc(users.name)) : [];
  const gset = await getSellerGoalSettings();
  const views = await Promise.all(sellers.map(async (u) => {
    const m = await getSellerMonth(u.id);
    const { targets, weights } = resolveSellerGoals(gset, u.sellerGoals ?? {});
    return { u, m, targets, weights, overall: attainment(m.actual, targets, weights).overall };
  }));
  const globalVals = Object.fromEntries(SELLER_METRICS.flatMap((m) => [[m.key, gset[m.key] ?? m.target], [`w_${m.key}`, gset[`w_${m.key}`] ?? m.weight]])) as Record<string, number>;
  const sellerPeople = views.map(({ u, overall }) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), own: (u.sellerGoals ?? {}) as Record<string, number>, overall }));
  const mine = views.find((v) => v.u.id === me.id);
  const both = showSdr && showSellers;

  const sdrData = async () => {
    const [list, done, sched] = await Promise.all([
      db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true), sql`not (${users.roles} = array['seller']::text[])`, visibleUsers(me), onlySelf ? eq(users.id, me.id) : undefined)).orderBy(asc(users.name)),
      db.select({ id: attendanceSessions.userId, n: sql<number>`count(*)::int` }).from(attendanceSessions)
        .where(sql`${attendanceSessions.outcome} = 'saved' and not ${attendanceSessions.isTest} and ${attendanceSessions.savedAt} >= ${today}`).groupBy(attendanceSessions.userId),
      db.execute<{ id: number; n: number }>(sql`select u as id, count(*)::int as n from (
          select v.user_id as u from visits v join leads l on l.id = v.lead_id where v.canceled_at is null and not l.is_test and v.created_at >= ${today}
          union all select d.sdr_id from deals d where not d.is_test and d.created_at >= ${today}) x group by u`),
    ]);
    return {
      global: { attended: { on: s.goal_attended_on === 1, qty: s.daily_goal }, scheduled: { on: s.goal_scheduled_on === 1, qty: s.daily_goal_scheduled } },
      people: list.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), today: { attended: done.find((d) => d.id === u.id)?.n ?? 0, scheduled: sched.find((d) => d.id === u.id)?.n ?? 0 }, own: { attended: { on: u.goalAttendedOn, qty: u.dailyGoal }, scheduled: { on: u.goalScheduledOn, qty: u.dailyGoalScheduled } } })),
    };
  };
  const subtitle = manage ? "Metas diárias de atendimento e agendamento (SDR) e mensais de vendas, da equipe e de cada pessoa." : "Suas metas, com o progresso de hoje e do mês.";
  const canEditSdr = canGlobal || editableIds.length > 0;
  const tabs: MetasTab[] = [];

  if (showSdr) {
    const sdr = await sdrData();
    tabs.push({
      key: "sdr", label: "Atendimento", icon: <Headset size={16} aria-hidden />, sub: "Metas diárias de atendidos e agendados.",
      view: <SdrOverview global={sdr.global} people={sdr.people} showTeam={manage && sdr.people.length > 1} />,
      edit: canEditSdr || manage ? <GoalsForm canGlobal={canGlobal} editableIds={editableIds} showGlobal={manage} global={sdr.global} people={sdr.people} /> : undefined,
    });
  }
  if (showSellers) {
    const avg = views.length ? Math.round(views.reduce((a, v) => a + v.overall, 0) / views.length) : 0;
    tabs.push({
      key: "vendas", label: "Vendas", icon: <Handshake size={16} aria-hidden />, sub: "Metas mensais, cada uma com o seu peso.",
      view: (
        <div className="space-y-4">
          {manage && views.length > 1 && <section className={`${panelCls} flex flex-wrap items-center gap-x-6 gap-y-2 p-5`}><div><p className="text-sm text-muted">Meta geral da equipe no mês</p><p className="figure text-4xl font-bold leading-none">{avg}%</p></div><div className="h-3 min-w-40 flex-1 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full ${avg >= 100 ? "bg-ok" : "bg-grad"}`} style={{ width: `${Math.min(100, avg)}%` }} /></div></section>}
          {mine && <SellerGoalPanel actual={mine.m.actual} targets={mine.targets} weights={mine.weights} bonusReais={mine.m.bonusReais} bonusSales={mine.m.bonusSales} monthLabel={mine.m.monthLabel} />}
          {manage && views.filter((v) => v.u.id !== me.id).length > 0 && (
            <div className="grid gap-3 xl:grid-cols-2">
              {views.filter((v) => v.u.id !== me.id).map((v) => <SellerGoalPanel key={v.u.id} compact name={v.u.name} hex={bubbleHex(v.u.accent, v.u.id, v.u.roles)} actual={v.m.actual} targets={v.targets} weights={v.weights} bonusReais={v.m.bonusReais} bonusSales={v.m.bonusSales} monthLabel={v.m.monthLabel} />)}
            </div>
          )}
        </div>
      ),
      edit: manage || (scope && mine) ? <SellerGoalsForm canGlobal={canGlobal} editableIds={editableIds} showGlobal={manage} global={globalVals} people={sellerPeople} /> : undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHead icon={Target} title="Metas" subtitle={subtitle} />
      <MetasShell tabs={tabs} />
    </div>
  );
}
