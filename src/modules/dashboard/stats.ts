import type { SettingKey } from "@/modules/settings/get";
import type { Role } from "@/config/roles";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TZ, dayEnd, dayStart } from "@/lib/format";
import { soldCents } from "@/modules/deals/goals";

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

  const [per, hours, meios, quals, visitsN, goals, convertedN, funnel, recentVisits, temp, stock, hot, noInfo, pendingVisits] = await Promise.all([
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
    db.execute<{ n: number }>(sql`select ((select count(*) from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.user_id in (${U}) and v.created_at between ${from} and ${to}) + (select count(*) from deals d where not d.is_test and d.sdr_id in (${U}) and d.created_at between ${from} and ${to}))::int as n`),
    db.execute<{ goal: number; goal_s: number; goal_c: number; goal_v: number }>(sql`select
        coalesce(sum(case when coalesce(u.goal_attended_on, ${gs.goal_attended_on}::int = 1) then coalesce(u.daily_goal, ${gs.daily_goal}::int) else 0 end), 0)::int as goal,
        coalesce(sum(case when coalesce(u.goal_scheduled_on, ${gs.goal_scheduled_on}::int = 1) then coalesce(u.daily_goal_scheduled, ${gs.daily_goal_scheduled}::int) else 0 end), 0)::int as goal_s,
        coalesce(sum(case when coalesce((u.goals_extra->>'calls_on')::int = 1, ${gs.goal_calls_on}::int = 1) then coalesce((u.goals_extra->>'calls')::int, ${gs.daily_goal_calls}::int) else 0 end), 0)::int as goal_c,
        coalesce(sum(case when coalesce((u.goals_extra->>'converted_on')::int = 1, ${gs.goal_converted_on}::int = 1) then coalesce((u.goals_extra->>'converted')::int, ${gs.daily_goal_converted}::int) else 0 end), 0)::int as goal_v
        from users u where u.id in (${U}) and coalesce(u.goals_extra->>'off_all', '0') <> '1'`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from deals d where not d.is_test and d.sdr_id in (${U}) and d.created_at between ${from} and ${to}`),
    db.execute<{ conversando: number }>(sql`select count(distinct s.lead_id)::int as conversando from attendance_sessions s
      join lead_tags lt on lt.lead_id = s.lead_id join tags t on t.id = lt.tag_id and t.key = 'conversando'
      where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to}`),
    db.execute<{ id: number; code: string; at: Date; company: string; name: string | null; uid: number | null; accent: string | null; roles: Role[] | null }>(sql`
      select v.id, v.code, v.created_at as at, l.company, u.name, u.id as uid, u.accent, u.roles from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.user_id
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
      where not l.is_test and l.updated_at < now() - make_interval(days => ${gs.alert_days})
        and not exists (select 1 from lead_tags x join tags tx on tx.id = x.tag_id where x.lead_id = l.id and tx.blocks_sorting)`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from leads where not is_test and enriched_at is null`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from visits v join leads l on l.id = v.lead_id where not l.is_test and v.status = 'pendente' and v.canceled_at is null and v.created_at < now() - make_interval(days => ${gs.alert_days}) and v.user_id in (${U})`),
  ]);

  const contacts = per.reduce((a, r) => a + r.n, 0);
  const goal = (goals[0]?.goal ?? 0) * days;
  const goalScheduled = (goals[0]?.goal_s ?? 0) * days;
  const goalCalls = (goals[0]?.goal_c ?? 0) * days;
  const goalConverted = (goals[0]?.goal_v ?? 0) * days;
  const calls = meios.find((m) => m.channel === "ligacao")?.n ?? 0;
  const converted = convertedN[0]?.n ?? 0;
  const timed = per.filter((r) => r.n > 0 && r.avg != null);
  const avg = timed.length ? timed.reduce((a, r) => a + Number(r.avg) * r.n, 0) / timed.reduce((a, r) => a + r.n, 0) : null;
  const meds = timed.map((r) => Number(r.med)).sort((a, b) => a - b);
  return {
    days, contacts, goal, goalScheduled, goalCalls, goalConverted, calls, converted, avgSeconds: avg, medianSeconds: meds.length ? meds[Math.floor(meds.length / 2)] : null,
    qualified: quals[0]?.n ?? 0, scheduled: visitsN[0]?.n ?? 0, conversing: funnel[0]?.conversando ?? 0,
    ranking: [...per].map((r) => ({ id: r.user_id, name: r.name, accent: r.accent, roles: r.roles as Role[], n: r.n, avgSeconds: r.avg == null ? null : Number(r.avg) })),
    hours: [...hours], meios: [...meios], temp: [...temp], stock: stock[0] ?? { novos: 0, trabalhados: 0, fora: 0, clientes: 0 },
    recentVisits: recentVisits.map((v) => ({ id: v.id, code: v.code, at: v.at.toString(), company: v.company, name: v.name, uid: v.uid, accent: v.accent, roles: v.roles })),
    alerts: { hot: hot[0]?.n ?? 0, noInfo: noInfo[0]?.n ?? 0, pendingVisits: pendingVisits[0]?.n ?? 0 },
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/**
 * Contatos feitos (ligação, WhatsApp e e-mail) com o resultado que a pessoa informou, para qualquer grupo de usuários (SDR ou vendedor).
 * Ligações: atendidas, sem resposta, número errado, tempo de conversa. WhatsApp e e-mail: enviados, respondidos, ignorados, voltaram.
 */
export async function getTouchStats(period: Period, userIds: number[]) {
  const U = ids(userIds.length ? userIds : [-1]);
  const from = sql`${dayStart(period.from).toISOString()}::timestamptz`;
  const to = sql`${dayEnd(period.to).toISOString()}::timestamptz`;
  const [r, per] = await Promise.all([
    db.execute<Record<string, number | null>>(sql`select
      count(*) filter (where e.channel = 'call' and e.outcome is not null)::int as calls,
      count(*) filter (where e.channel = 'call' and e.outcome in ('atendeu', 'recado'))::int as calls_answered,
      count(*) filter (where e.channel = 'call' and e.outcome = 'atendeu')::int as calls_talked,
      count(*) filter (where e.channel = 'call' and e.outcome = 'recado')::int as calls_message,
      count(*) filter (where e.channel = 'call' and e.outcome in ('nao_atendeu', 'caixa_postal', 'ocupado'))::int as calls_noanswer,
      count(*) filter (where e.channel = 'call' and e.outcome = 'caixa_postal')::int as calls_voicemail,
      count(*) filter (where e.channel = 'call' and e.outcome = 'numero_errado')::int as calls_wrong,
      sum(e.duration_sec) filter (where e.channel = 'call' and e.outcome in ('atendeu', 'recado'))::float as talk_secs,
      max(e.duration_sec) filter (where e.channel = 'call')::int as longest_call,
      count(*) filter (where e.channel = 'call' and e.outcome in ('atendeu', 'recado') and e.duration_sec is not null)::int as calls_with_secs,
      count(*) filter (where e.channel = 'whatsapp')::int as wa_sent,
      count(*) filter (where e.channel = 'whatsapp' and e.outcome = 'respondeu')::int as wa_replied,
      count(*) filter (where e.channel = 'whatsapp' and e.outcome in ('recebida', 'ignorada'))::int as wa_silent,
      count(*) filter (where e.channel = 'whatsapp' and e.outcome = 'sem_whatsapp')::int as wa_none,
      count(*) filter (where e.channel = 'email')::int as em_sent,
      count(*) filter (where e.channel = 'email' and e.outcome = 'respondeu')::int as em_replied,
      count(*) filter (where e.channel = 'email' and e.outcome = 'recebido')::int as em_opened,
      count(*) filter (where e.channel = 'email' and e.outcome = 'voltou')::int as em_bounced,
      count(*) filter (where e.outcome is null)::int as pending,
      count(*) filter (where e.person_id is not null and e.outcome in ('atendeu', 'respondeu'))::int as with_person,
      count(distinct e.lead_id)::int as leads,
      count(*)::int as total
      from contact_events e where not e.is_test and e.user_id in (${U}) and e.at between ${from} and ${to}`),
    db.execute<{ multi: number }>(sql`select count(*)::int as multi from (select e.lead_id from contact_events e where not e.is_test and e.user_id in (${U}) and e.at between ${from} and ${to} group by e.lead_id having count(distinct e.channel) >= 2) x`),
  ]);
  const n = (k: string) => Number(r[0]?.[k] ?? 0);
  const answered = n("calls_answered"), withSecs = n("calls_with_secs");
  return {
    calls: n("calls"), callsAnswered: answered, callsTalked: n("calls_talked"), callsMessage: n("calls_message"), callsNoAnswer: n("calls_noanswer"), callsVoicemail: n("calls_voicemail"), callsWrong: n("calls_wrong"),
    talkSeconds: n("talk_secs"), avgTalkSeconds: withSecs ? n("talk_secs") / withSecs : 0, longestCall: n("longest_call"),
    waSent: n("wa_sent"), waReplied: n("wa_replied"), waSilent: n("wa_silent"), waNone: n("wa_none"),
    emSent: n("em_sent"), emReplied: n("em_replied"), emOpened: n("em_opened"), emBounced: n("em_bounced"),
    pending: n("pending"), withPerson: n("with_person"), leads: n("leads"), total: n("total"), multiChannel: per[0]?.multi ?? 0,
    touchesPerLead: n("leads") ? n("total") / n("leads") : 0,
  };
}
export type TouchStats = Awaited<ReturnType<typeof getTouchStats>>;

/** Indicadores extras do SDR: resultado dos atendimentos, visitas por andamento, tempo total, vendas originadas, série por dia e comparação com o período anterior. */
export async function getDashboardExtra(period: Period, userIds: number[]) {
  const U = ids(userIds.length ? userIds : [-1]);
  const days = periodDays(period);
  const from = sql`${dayStart(period.from).toISOString()}::timestamptz`;
  const to = sql`${dayEnd(period.to).toISOString()}::timestamptz`;
  const prevFrom = sql`${new Date(dayStart(period.from).getTime() - days * 86400_000).toISOString()}::timestamptz`;
  const prevTo = sql`${new Date(dayStart(period.from).getTime() - 1).toISOString()}::timestamptz`;
  const [outcomes, series, vis, secs, origin, prev] = await Promise.all([
    db.execute<{ outcome: string; n: number }>(sql`select coalesce(s.outcome, 'aberto') as outcome, count(*)::int as n from attendance_sessions s
      where not s.is_test and s.user_id in (${U}) and coalesce(s.saved_at, s.shown_at) between ${from} and ${to} group by 1`),
    db.execute<{ d: string; n: number }>(sql`select to_char(s.saved_at at time zone ${TZ}, 'YYYY-MM-DD') as d, count(*)::int as n from attendance_sessions s
      where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to} group by 1 order by 1`),
    db.execute<{ status: string; n: number }>(sql`select v.status, count(*)::int as n from visits v join leads l on l.id = v.lead_id
      where not l.is_test and v.canceled_at is null and v.user_id in (${U}) and v.created_at between ${from} and ${to} group by 1`),
    db.execute<{ secs: number | null }>(sql`select sum(extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at))))::float as secs from attendance_sessions s
      where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${from} and ${to}`),
    db.execute<{ n: number; v: number }>(sql`select count(*)::int as n, coalesce(sum(${soldCents}), 0)::bigint as v from deals d
      where d.stage = 'ganho' and not d.is_test and d.sdr_id in (${U}) and d.closed_at between ${from} and ${to}`),
    db.execute<{ contacts: number; qualified: number; scheduled: number }>(sql`select
      (select count(*) from attendance_sessions s where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${prevFrom} and ${prevTo})::int as contacts,
      (select count(distinct s.lead_id) from attendance_sessions s join lead_tags lt on lt.lead_id = s.lead_id join tags t on t.id = lt.tag_id and t.key = 'qualificado'
         where s.outcome = 'saved' and not s.is_test and s.user_id in (${U}) and s.saved_at between ${prevFrom} and ${prevTo})::int as qualified,
      (select count(*) from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.user_id in (${U}) and v.created_at between ${prevFrom} and ${prevTo})::int as scheduled`),
  ]);
  const c = await getTouchStats(period, userIds);
  const o = (k: string) => outcomes.find((x) => x.outcome === k)?.n ?? 0;
  const v = (k: string) => vis.find((x) => x.status === k)?.n ?? 0;
  const byDay = new Map(series.map((r) => [r.d, r.n]));
  const daily: { d: string; n: number }[] = [];
  for (let i = 0; i < Math.min(days, 62); i++) { const d = iso(new Date(dayStart(period.from).getTime() + i * 86400_000 + 6 * 3600_000)); daily.push({ d, n: byDay.get(d) ?? 0 }); }
  // sequência atual: dias seguidos (terminando hoje ou ontem) com ao menos 1 atendimento no período mostrado
  let streak = 0; for (let i = daily.length - 1; i >= 0; i--) { if (daily[i].n > 0) streak++; else if (i === daily.length - 1) continue; else break; }
  return {
    saved: o("saved"), skipped: o("skipped"), released: o("released"), discarded: o("discarded"), abandoned: o("abandoned"),
    visitsPending: v("pendente"), visitsConfirmed: v("confirmada"), visitsDone: v("realizada"),
    totalSeconds: Number(secs[0]?.secs ?? 0), originated: origin[0]?.n ?? 0, originatedValue: Number(origin[0]?.v ?? 0),
    touch: c,
    daily, streak, prev: prev[0] ?? { contacts: 0, qualified: 0, scheduled: 0 },
  };
}
export type DashboardExtra = Awaited<ReturnType<typeof getDashboardExtra>>;
