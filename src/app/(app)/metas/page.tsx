import { metricUsers, visibleUsers } from "@/modules/auth/visibility";
import { Handshake, Headset, Target } from "lucide-react";
import { MetasShell, type MetasTab } from "@/components/metas-shell";
import { SdrOverview } from "@/components/goals-overview";
import { PeriodFilter } from "@/components/period-filter";
import { SellerTeamTiles } from "@/components/deals/seller-team-tiles";
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
import { sdrPace, sellerPace, workdays, type DayRow, type MonthCtx } from "@/config/pace";
import { goalsOff, ownGoals, SDR_KINDS, type GoalKind } from "@/modules/settings/goals";
import { getSellerGoalSettings, getSellerMonth } from "@/modules/deals/goals";
import { SellerGoalPanel } from "@/components/deals/seller-goal-panel";
import { attainment, resolveSellerGoals, SELLER_METRICS } from "@/config/seller-goals";

export const metadata: Metadata = { title: "Metas" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.metas");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const spDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  const todayStr = spDate(new Date());
  /** Filtros: dia (SDR) e mês (Vendas). Só passado ou hoje. */
  const dayStr = /^\d{4}-\d{2}-\d{2}$/.test(one("d")) && one("d") <= todayStr ? one("d") : todayStr;
  const monthStr = /^\d{4}-\d{2}$/.test(one("m")) && one("m") <= todayStr.slice(0, 7) ? one("m") : todayStr.slice(0, 7);
  const isToday = dayStr === todayStr, isThisMonth = monthStr === todayStr.slice(0, 7);
  const dayFrom = sql`((${dayStr}::date)::timestamp at time zone 'America/Sao_Paulo')`;
  const dayTo = sql`(((${dayStr}::date)::timestamp + interval '1 day') at time zone 'America/Sao_Paulo')`;
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

  const sellers = showSellers ? await db.select().from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, onlySelf ? eq(users.id, me.id) : undefined, metricUsers(me))).orderBy(asc(users.name)) : [];
  const gset = await getSellerGoalSettings();
  const views = await Promise.all(sellers.map(async (u) => {
    const m = await getSellerMonth(u.id, monthStr);
    const { targets, weights, enabled, allOff } = resolveSellerGoals(gset, u.sellerGoals ?? {});
    return { u, m, targets, weights, enabled, allOff, overall: attainment(m.actual, targets, weights, enabled).overall };
  }));
  const globalVals = Object.fromEntries(SELLER_METRICS.flatMap((m) => [[m.key, gset[m.key] ?? m.target], [`w_${m.key}`, gset[`w_${m.key}`] ?? m.weight], [`off_${m.key}`, gset[`off_${m.key}`] ?? 0]])) as Record<string, number>;
  const sellerPeople = views.map(({ u, overall }) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), own: (u.sellerGoals ?? {}) as Record<string, number>, overall }));
  const mine = views.find((v) => v.u.id === me.id);
  const [yy, mm] = todayStr.split("-").map(Number);
  const mctx: MonthCtx = { today: todayStr, first: `${todayStr.slice(0, 7)}-01`, last: `${todayStr.slice(0, 7)}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}` };
  const monthWd = workdays(mctx.first, mctx.last);
  const monthName = new Date(yy, mm - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  const pacesOf = (v: { m: { actual: Record<string, number> }; targets: Record<string, number> }) => Object.fromEntries(SELLER_METRICS.map((m) => [m.key, sellerPace(v.m.actual[m.key], v.targets[m.key], mctx)]));
  const both = showSdr && showSellers;

  const sdrData = async () => {
    const [list, done, sched, calls, conv] = await Promise.all([
      db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true), sql`not (${users.roles} = array['seller']::text[])`, visibleUsers(me), onlySelf ? eq(users.id, me.id) : undefined)).orderBy(asc(users.name)),
      db.select({ id: attendanceSessions.userId, n: sql<number>`count(*)::int` }).from(attendanceSessions)
        .where(sql`${attendanceSessions.outcome} = 'saved' and not ${attendanceSessions.isTest} and ${attendanceSessions.savedAt} >= ${dayFrom} and ${attendanceSessions.savedAt} < ${dayTo}`).groupBy(attendanceSessions.userId),
      db.execute<{ id: number; n: number }>(sql`select u as id, count(*)::int as n from (
          select v.user_id as u from visits v join leads l on l.id = v.lead_id where v.canceled_at is null and not l.is_test and v.created_at >= ${dayFrom} and v.created_at < ${dayTo}
          union all select d.sdr_id from deals d where not d.is_test and d.created_at >= ${dayFrom} and d.created_at < ${dayTo}) x group by u`),
      db.execute<{ id: number; n: number }>(sql`select i.user_id as id, count(*)::int as n from interactions i where not i.is_test and i.channel = 'ligacao' and i.at >= ${dayFrom} and i.at < ${dayTo} group by 1`),
      db.execute<{ id: number; n: number }>(sql`select d.sdr_id as id, count(*)::int as n from deals d where not d.is_test and d.created_at >= ${dayFrom} and d.created_at < ${dayTo} group by 1`),
    ]);
    const n = (rows: { id: number | null; n: number }[], id: number) => rows.find((d) => d.id === id)?.n ?? 0;
    return {
      global: Object.fromEntries(SDR_KINDS.map((d) => [d.k, { on: s[d.on] === 1, qty: s[d.qty] }])) as Record<GoalKind, { on: boolean; qty: number }>,
      people: list.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles), off: goalsOff(u), today: { attended: n(done, u.id), scheduled: n(sched, u.id), calls: n(calls, u.id), converted: n(conv, u.id) }, own: ownGoals(u) })),
    };
  };
  const canEditSdr = canGlobal || editableIds.length > 0;
  const tabs: MetasTab[] = [];

  if (showSdr) {
    const sdr = await sdrData();
    const rows = sdr.people.length ? await db.execute<{ uid: number; k: string; day: string; n: number; first: string | null }>(sql`select uid, k, day::text as day, count(*)::int as n, to_char(min(ts) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as first from (
        select user_id as uid, 'attended' as k, (saved_at at time zone 'America/Sao_Paulo')::date as day, saved_at as ts from attendance_sessions where user_id in (${sql.join(sdr.people.map((p) => sql`${p.id}`), sql`, `)}) and outcome = 'saved' and not is_test and saved_at >= now() - interval '16 days'
        union all select v.user_id, 'scheduled', (v.created_at at time zone 'America/Sao_Paulo')::date, v.created_at from visits v join leads l on l.id = v.lead_id where v.user_id in (${sql.join(sdr.people.map((p) => sql`${p.id}`), sql`, `)}) and v.canceled_at is null and not l.is_test and v.created_at >= now() - interval '16 days'
        union all select d.sdr_id, 'scheduled', (d.created_at at time zone 'America/Sao_Paulo')::date, d.created_at from deals d where d.sdr_id in (${sql.join(sdr.people.map((p) => sql`${p.id}`), sql`, `)}) and not d.is_test and d.created_at >= now() - interval '16 days'
        union all select i.user_id, 'calls', (i.at at time zone 'America/Sao_Paulo')::date, i.at from interactions i where i.user_id in (${sql.join(sdr.people.map((p) => sql`${p.id}`), sql`, `)}) and not i.is_test and i.channel = 'ligacao' and i.at >= now() - interval '16 days'
        union all select d.sdr_id, 'converted', (d.created_at at time zone 'America/Sao_Paulo')::date, d.created_at from deals d where d.sdr_id in (${sql.join(sdr.people.map((p) => sql`${p.id}`), sql`, `)}) and not d.is_test and d.created_at >= now() - interval '16 days') x group by uid, k, day`) : [];
    const paces: Record<number, Partial<Record<GoalKind, ReturnType<typeof sdrPace>>>> = {};
    for (const p of sdr.people) {
      const mine = (rows as unknown as { uid: number; k: string; day: string; n: number; first: string | null }[]).filter((r) => r.uid === p.id) as DayRow[];
      paces[p.id] = !isToday ? {} : Object.fromEntries(SDR_KINDS.map((d) => [d.k, sdrPace(mine, d.k, p.own[d.k].qty ?? sdr.global[d.k].qty)]));
    }
    tabs.push({
      key: "sdr", label: "Atendimento", icon: <Headset size={16} aria-hidden />, sub: "Atendidos, agendados, ligações e convertidos.",
      view: <SdrOverview global={sdr.global} people={sdr.people} paces={paces} isToday={isToday} dayLabel={isToday ? "hoje" : `em ${dayStr.slice(8)}/${dayStr.slice(5, 7)}`} showTeam={manage && sdr.people.length > 1} />,
      filter: <PeriodFilter kind="day" value={dayStr} max={todayStr} />,
      edit: canEditSdr || manage ? <GoalsForm wd={monthWd} monthLabel={monthName} canGlobal={canGlobal} editableIds={editableIds} showGlobal={manage} global={sdr.global} people={sdr.people} /> : undefined,
    });
  }
  if (showSellers) {
    const counted = views.filter((v) => !v.allOff && Object.values(v.enabled).some(Boolean));
    const avg = counted.length ? Math.round(counted.reduce((a, v) => a + v.overall, 0) / counted.length) : 0;
    tabs.push({
      key: "vendas", label: "Vendas", icon: <Handshake size={16} aria-hidden />, sub: "Metas mensais, cada uma com o seu peso.",
      view: (
        <div className="space-y-4">
          {manage && counted.length > 0 && <SellerTeamTiles rows={counted.map((v) => ({ actual: v.m.actual, targets: v.targets, enabled: v.enabled, overall: v.overall }))} monthLabel={views[0]?.m.monthLabel ?? ""} />}
          {mine && <SellerGoalPanel wide={views.length === 1} paces={isThisMonth ? pacesOf(mine) : undefined} actual={mine.m.actual} targets={mine.targets} weights={mine.weights} enabled={mine.enabled} allOff={mine.allOff} bonusReais={mine.m.bonusReais} bonusSales={mine.m.bonusSales} monthLabel={mine.m.monthLabel} />}
          {manage && views.filter((v) => v.u.id !== me.id).length > 0 && (
            <div className="panel-grid">
              {views.filter((v) => v.u.id !== me.id).map((v) => <SellerGoalPanel key={v.u.id} wide={views.length === 1} paces={isThisMonth ? pacesOf(v) : undefined} compact name={v.u.name} hex={bubbleHex(v.u.accent, v.u.id, v.u.roles)} actual={v.m.actual} targets={v.targets} weights={v.weights} enabled={v.enabled} allOff={v.allOff} bonusReais={v.m.bonusReais} bonusSales={v.m.bonusSales} monthLabel={v.m.monthLabel} />)}
            </div>
          )}
        </div>
      ),
      filter: <PeriodFilter kind="month" value={monthStr} max={todayStr.slice(0, 7)} />,
      edit: manage || (scope && mine) ? <SellerGoalsForm wd={monthWd} monthLabel={monthName} canGlobal={canGlobal} editableIds={editableIds} showGlobal={manage} global={globalVals} people={sellerPeople} /> : undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHead icon={Target} title="Metas" />
      <MetasShell tabs={tabs} />
    </div>
  );
}
