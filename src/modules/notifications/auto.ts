import { sql } from "drizzle-orm";
import { db } from "@/db";

const g = globalThis as unknown as { __autoNotif?: Map<number, number> };
const EVERY_MS = 60_000;

/**
 * Notificações que dependem do relógio (tarefa chegando, visita de hoje, negociação parada).
 * Rodam quando o sino consulta, no máximo uma vez por minuto por pessoa, e cada aviso só nasce uma vez (o link carrega o id).
 */
export async function syncAutoNotifications(uid: number): Promise<void> {
  const map = (g.__autoNotif ??= new Map());
  if (Date.now() - (map.get(uid) ?? 0) < EVERY_MS) return;
  map.set(uid, Date.now());
  try {
    // tarefas: atrasadas (até 2 dias) ou que vencem nos próximos 45 min
    await db.execute(sql`
      insert into notifications (user_id, kind, title, body, href)
      select t.user_id, 'tarefa', case when t.due_at < now() then 'Tarefa atrasada' else 'Tarefa chegando' end, left(t.title, 200), '/tarefas?t=' || t.id
      from tasks t
      where t.user_id = ${uid} and t.done_at is null and t.due_at is not null and t.due_at <= now() + interval '45 minutes' and t.due_at > now() - interval '2 days'
        and not exists (select 1 from notifications n where n.user_id = t.user_id and n.href = '/tarefas?t=' || t.id and n.created_at > t.due_at - interval '3 hours')
      order by t.due_at limit 8`);
    // visitas marcadas para hoje que ainda não aconteceram
    await db.execute(sql`
      insert into notifications (user_id, kind, title, body, href)
      select v.user_id, 'visita', 'Visita hoje', left(l.company, 200), '/leads/' || v.lead_id || '?v=' || v.id
      from visits v join leads l on l.id = v.lead_id
      where v.user_id = ${uid} and v.canceled_at is null and v.status <> 'realizada' and v.visit_date = (now() at time zone 'America/Sao_Paulo')::date
        and not exists (select 1 from notifications n where n.user_id = v.user_id and n.href = '/leads/' || v.lead_id || '?v=' || v.id and n.created_at > now() - interval '20 hours')
      limit 8`);
    // negociações abertas sem nenhum movimento há 5 dias
    await db.execute(sql`
      insert into notifications (user_id, kind, title, body, href)
      select d.seller_id, 'negociacao', 'Negociação parada há ' || (extract(day from now() - x.last))::int || ' dias', left(l.company, 200), '/negociacoes/' || d.id
      from deals d join leads l on l.id = d.lead_id
      cross join lateral (select coalesce((select max(e.at) from deal_events e where e.deal_id = d.id), d.claimed_at, d.created_at) as last) x
      where d.seller_id = ${uid} and not d.is_test and d.stage not in ('ganho', 'perdido') and x.last < now() - interval '5 days'
        and not exists (select 1 from notifications n where n.user_id = d.seller_id and n.href = '/negociacoes/' || d.id and n.title like 'Negociação parada%' and n.created_at > now() - interval '3 days')
      order by x.last limit 5`);
  } catch { /* extra: nunca atrapalha o sino */ }
}
