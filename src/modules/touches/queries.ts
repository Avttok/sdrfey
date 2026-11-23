import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { TargetStat, TouchChannel, TouchRow } from "@/config/touches";

/** Últimos contatos de um lead (todos os canais), do mais novo ao mais antigo. */
export async function leadTouches(leadId: number, limit = 40): Promise<{ rows: TouchRow[]; stats: TargetStat[] }> {
  const rows = await db.execute<{ id: number; channel: string; target: string; outcome: string | null; person_id: number | null; person: string | null; note: string | null; duration_sec: number | null; at: string; user_name: string | null; run_id: string | null }>(sql`
    select e.id, e.channel, e.target, e.outcome, e.person_id, p.name as person, e.note, e.duration_sec, e.at, u.name as user_name, e.run_id
    from contact_events e left join lead_people p on p.id = e.person_id left join users u on u.id = e.user_id
    where e.lead_id = ${leadId} order by e.at desc limit ${limit}`);
  const stats = await db.execute<{ channel: string; target: string; attempts: number; last_outcome: string | null; last_at: string; reached: number }>(sql`
    select channel, target, count(*)::int as attempts, (array_agg(outcome order by at desc))[1] as last_outcome, max(at) as last_at,
      count(*) filter (where outcome in ('atendeu','recado','respondeu'))::int as reached
    from contact_events where lead_id = ${leadId} group by channel, target`);
  return {
    rows: rows.map((r) => ({ id: Number(r.id), channel: r.channel as TouchChannel, target: r.target, outcome: r.outcome, personId: r.person_id == null ? null : Number(r.person_id), personName: r.person, note: r.note, durationSec: r.duration_sec, at: new Date(r.at).toISOString(), userName: r.user_name, runId: r.run_id })),
    stats: stats.map((r) => ({ channel: r.channel as TouchChannel, target: r.target, attempts: Number(r.attempts), lastOutcome: r.last_outcome, lastAt: new Date(r.last_at).toISOString(), reached: Number(r.reached) })),
  };
}

/** Ligações do dia de uma pessoa (hoje, horário de Brasília) para a janela de Tarefas. */
export async function todayCalls(userId: number): Promise<{ made: number; reached: number; pending: number; recent: { id: number; leadId: number; company: string; target: string; outcome: string | null; at: string }[] }> {
  const day = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'`;
  const [c] = await db.execute<{ made: number; reached: number; pending: number }>(sql`
    select count(*)::int as made, count(*) filter (where outcome in ('atendeu','recado'))::int as reached, count(*) filter (where outcome is null)::int as pending
    from contact_events where user_id = ${userId} and channel = 'call' and is_test = false and at >= ${day}`);
  const recent = await db.execute<{ id: number; lead_id: number; company: string; target: string; outcome: string | null; at: string }>(sql`
    select e.id, e.lead_id, coalesce(l.trade_name, l.company) as company, e.target, e.outcome, e.at from contact_events e join leads l on l.id = e.lead_id
    where e.user_id = ${userId} and e.channel = 'call' and e.is_test = false and e.at >= ${day} order by e.at desc limit 8`);
  return { made: Number(c?.made ?? 0), reached: Number(c?.reached ?? 0), pending: Number(c?.pending ?? 0), recent: recent.map((r) => ({ id: Number(r.id), leadId: Number(r.lead_id), company: r.company, target: r.target, outcome: r.outcome, at: new Date(r.at).toISOString() })) };
}
