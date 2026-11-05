import type { SettingKey } from "@/modules/settings/get";
import type { Role } from "@/config/roles";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TZ, dayEnd, dayStart } from "@/lib/format";

export type Period = { from: string; to: string; preset: "hoje" | "7" | "30" | "custom" };

const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // AAAA-MM-DD em Brasília

export function resolvePeriod(sp: { p?: string; from?: string; to?: string }): Period {
  const today = iso(new Date());
  if (sp.from || sp.to) { const from = sp.from ?? sp.to!; const to = sp.to ?? sp.from!; return from <= to ? { from, to, preset: "custom" } : { from: to, to: from, preset: "custom" }; }
  const back = sp.p === "30" ? 29 : sp.p === "7" ? 6 : 0;
  const from = iso(new Date(Date.now() - back * 86400_000));
  return { from, to: today, preset: sp.p === "30" ? "30" : sp.p === "7" ? "7" : "hoje" };
}
export const periodDays = (p: Period) => Math.round((dayStart(p.to).getTime() - dayStart(p.from).getTime()) / 86400_000) + 1;

const ids = (list: number[]) => sql.join(list.map((i) => sql`${i}`), sql`, `);

export async function getDashboard(period: Period, userIds: number[], gs: Record<SettingKey, number>) {
  if (userIds.length === 0) userIds = [-1];
  const from = sql`${dayStart(period.from).toISOString()}::timestamptz`;
  const to = sql`${dayEnd(period.to).toISOString()}::timestamptz`;
  const days = periodDays(period);
  const U = ids(userIds);

  const [per, hours, meios, quals, visitsN, goals, funnel, recentVisits, temp, stock, hot, noInfo] = await Promise.all([
    db.execute<{ user_id: number; name: string; accent: string | null; roles: string[]; n: number; avg: number | null; med: number | null }>(sql`
      select u.id as user_id, u.name, u.accent, u.roles, count(s.id)::int as n,
        avg(extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at)))) as avg,
        percentile_cont(0.5) within group (order by extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at)))) as med
      from users u left join attendance_sessions s on s.user_id = u.id and s.outcome = 'saved' and not s.is_test and s.saved_at between ${from} and ${to}
      where u.id in (${U}) group by u.id order by n desc, u.name`),
    db.execute<{ h: number; uid: number; n: number }>(sql`
      select extract(hour from s.saved_at at time zone ${TZ})::int as h, s.user_id as uid, count(*)::int as n from attendance_sessions s
      where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to} group by 1, 2 order by 1, 2`),
    db.execute<{ channel: string; label: string; color: string; n: number; q: number }>(sql`
      select i.channel, t.label, t.color, count(*)::int as n,
        count(*) filter (where exists (select 1 from lead_tags lt join tags qt on qt.id = lt.tag_id where lt.lead_id = i.lead_id and qt.key = 'qualificado'))::int as q
      from interactions i join tags t on t.group_key = 'meio' and t.key = i.channel
      where not i.is_test and i.user_id in (${U}) and i.at between ${from} and ${to} group by 1, 2, 3 order by n desc`),
    /* Qualificados = leads atendidos (e salvos) no período por essa equipe que hoje têm a tag Qualificado.
       Tags vindas de importação não contam: só trabalho real, para a taxa nunca passar de 100%. */
    db.execute<{ n: number }>(sql`select count(distinct s.lead_id)::int as n from attendance_sessions s
      join lead_tags lt on lt.lead_id = s.lead_id join tags t on t.id = lt.tag_id and t.key = 'qualificado'
      where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to}`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.user_id in (${U}) and v.created_at between ${from} and ${to}`),
    db.execute<{ goal: number; goal_s: number }>(sql`select
        coalesce(sum(case when coalesce(u.goal_attended_on, ${gs.goal_attended_on}::int = 1) then coalesce(u.daily_goal, ${gs.daily_goal}::int) else 0 end), 0)::int as goal,
        coalesce(sum(case when coalesce(u.goal_scheduled_on, ${gs.goal_scheduled_on}::int = 1) then coalesce(u.daily_goal_scheduled, ${gs.daily_goal_scheduled}::int) else 0 end), 0)::int as goal_s
        from users u where u.id in (${U})`),
    db.execute<{ conversando: number }>(sql`select count(distinct s.lead_id)::int as conversando from attendance_sessions s
      join lead_tags lt on lt.lead_id = s.lead_id join tags t on t.id = lt.tag_id and t.key = 'conversando'
      where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to}`),
    db.execute<{ code: string; at: Date; company: string; name: string | null }>(sql`
      select v.code, v.created_at as at, l.company, u.name from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.user_id
      where not l.is_test and v.canceled_at is null and (v.user_id in (${U})) order by v.created_at desc limit 8`),
    db.execute<{ key: string; label: string; color: string; n: number }>(sql`
      select t.key, t.label, t.color, count(*)::int as n from lead_tags lt join tags t on t.id = lt.tag_id join leads l on l.id = lt.lead_id
      where t.group_key = 'temperatura' and t.active and not l.is_test group by 1, 2, 3, t.sort order by t.sort`),
    db.execute<{ novos: number; trabalhados: number; fora: number; clientes: number }>(sql`
      with b as (select lt.lead_id, bool_or(t.key = 'cliente') as cliente from lead_tags lt join tags t on t.id = lt.tag_id where t.blocks_sorting group by 1)
      select count(*) filter (where b.lead_id is null and l.times_worked = 0)::int as novos,
             count(*) filter (where b.lead_id is null and l.times_worked > 0)::int as trabalhados,
             count(*) filter (where b.lead_id is not null and not b.cliente)::int as fora,
             count(*) filter (where b.cliente)::int as clientes
      from leads l left join b on b.lead_id = l.id where not l.is_test`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from leads l join lead_tags lt on lt.lead_id = l.id join tags t on t.id = lt.tag_id and t.key = 'quente'
      where not l.is_test and l.updated_at < now() - interval '3 days'
        and not exists (select 1 from lead_tags x join tags tx on tx.id = x.tag_id where x.lead_id = l.id and tx.blocks_sorting)`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from leads where not is_test and enriched_at is null`),
  ]);

  const contacts = per.reduce((a, r) => a + r.n, 0);
  const goal = (goals[0]?.goal ?? 0) * days;
  const goalScheduled = (goals[0]?.goal_s ?? 0) * days;
  const timed = per.filter((r) => r.n > 0 && r.avg != null);
  const avg = timed.length ? timed.reduce((a, r) => a + Number(r.avg) * r.n, 0) / timed.reduce((a, r) => a + r.n, 0) : null;
  const meds = timed.map((r) => Number(r.med)).sort((a, b) => a - b);
  return {
    days, contacts, goal, goalScheduled, avgSeconds: avg, medianSeconds: meds.length ? meds[Math.floor(meds.length / 2)] : null,
    qualified: quals[0]?.n ?? 0, scheduled: visitsN[0]?.n ?? 0, conversing: funnel[0]?.conversando ?? 0,
    ranking: [...per].map((r) => ({ id: r.user_id, name: r.name, accent: r.accent, roles: r.roles as Role[], n: r.n, avgSeconds: r.avg == null ? null : Number(r.avg) })),
    hours: [...hours], meios: [...meios], temp: [...temp], stock: stock[0] ?? { novos: 0, trabalhados: 0, fora: 0, clientes: 0 },
    recentVisits: recentVisits.map((v) => ({ code: v.code, at: v.at.toString(), company: v.company, name: v.name })),
    alerts: { hot: hot[0]?.n ?? 0, noInfo: noInfo[0]?.n ?? 0 },
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
