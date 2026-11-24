import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { OBJECTIVES, isObjective } from "@/config/objectives";

/** Painel de uso dos roteiros (só Adm): quanto se usa, onde as ligações param, que objeções aparecem. */
export type UsageFilter = { days: number | null; userId: number | null; withTests: boolean };
export type UsageRow = { label: string; runs: number; done: number; converted: number; scheduled: number; quote: number; stopped: number; avgSec: number };
export type Usage = {
  total: UsageRow; byObjective: UsageRow[]; byScript: UsageRow[]; byUser: UsageRow[];
  objections: { title: string; times: number; runs: number }[]; stops: { title: string; times: number }[];
  users: { id: number; name: string }[]; tests: number;
};

const where = (f: UsageFilter): SQL => sql`where true ${f.withTests ? sql`` : sql`and not c.is_test`} ${f.days ? sql`and c.started_at >= now() - (${f.days} * interval '1 day')` : sql``} ${f.userId ? sql`and c.user_id = ${f.userId}` : sql``}`;

const cols = sql`count(*)::int as runs,
  count(*) filter (where c.finished)::int as done,
  count(*) filter (where c.finished and c.outcome = 'venda')::int as converted,
  count(*) filter (where c.finished and c.outcome in ('visita','retorno'))::int as scheduled,
  count(*) filter (where c.finished and c.outcome = 'cotacao')::int as quote,
  count(*) filter (where not c.finished)::int as stopped,
  coalesce(avg(greatest(0, extract(epoch from (c.updated_at - c.started_at)))) filter (where c.finished), 0)::int as avg_sec`;

type Raw = { label: string; runs: number; done: number; converted: number; scheduled: number; quote: number; stopped: number; avg_sec: number };
const row = (r: Raw): UsageRow => ({ label: r.label, runs: r.runs, done: r.done, converted: r.converted, scheduled: r.scheduled, quote: r.quote, stopped: r.stopped, avgSec: r.avg_sec });

export async function scriptUsage(f: UsageFilter): Promise<Usage> {
  const w = where(f);
  const [tot, obj, scr, usr, objn, stops, users, tests] = await Promise.all([
    db.execute<Raw>(sql`select 'Total' as label, ${cols} from call_scripts c ${w}`),
    db.execute<Raw>(sql`select coalesce(c.objective, '') as label, ${cols} from call_scripts c ${w} group by 1 order by 2 desc`),
    db.execute<Raw>(sql`select c.script_title as label, ${cols} from call_scripts c ${w} group by 1 order by 2 desc limit 30`),
    db.execute<Raw>(sql`select u.name as label, ${cols} from call_scripts c join users u on u.id = c.user_id ${w} group by 1 order by 2 desc`),
    db.execute<{ title: string; times: number; runs: number }>(sql`select s->>'title' as title, count(*)::int as times, count(distinct c.id)::int as runs
      from call_scripts c cross join lateral jsonb_array_elements(c.steps) s ${w} and s->>'id' like 'obj\_%' and s->>'id' not like 'obj\_menu%' group by 1 order by 2 desc limit 15`),
    db.execute<{ title: string; times: number }>(sql`select c.steps->-1->>'title' as title, count(*)::int as times from call_scripts c ${w} and not c.finished and jsonb_array_length(c.steps) > 0 group by 1 order by 2 desc limit 10`),
    db.execute<{ id: number; name: string }>(sql`select id, name from users order by name`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from call_scripts where is_test`),
  ]);
  const label = (r: Raw) => (isObjective(r.label) ? OBJECTIVES[r.label].label : r.label === "" ? "Sem objetivo" : r.label);
  return {
    total: row(tot[0] ?? { label: "Total", runs: 0, done: 0, converted: 0, scheduled: 0, quote: 0, stopped: 0, avg_sec: 0 }),
    byObjective: [...obj].map((r) => ({ ...row(r), label: label(r) })), byScript: [...scr].map(row), byUser: [...usr].map(row),
    objections: [...objn], stops: [...stops].map((s) => ({ title: s.title ?? "—", times: s.times })), users: [...users], tests: tests[0]?.n ?? 0,
  };
}

/** Uma linha por ligação, para baixar (CSV). */
export async function usageRows(f: UsageFilter) {
  return [...(await db.execute<Record<string, unknown>>(sql`select c.id, c.started_at, u.name as usuario, coalesce(l.trade_name, l.company) as empresa, c.script_title as roteiro, coalesce(c.objective,'') as objetivo, c.goal as categoria, c.segment as segmento, c.finished as concluida, coalesce(c.outcome,'') as resultado, greatest(0, extract(epoch from (c.updated_at - c.started_at)))::int as segundos, jsonb_array_length(c.steps) as passos, c.is_test as teste
    from call_scripts c join users u on u.id = c.user_id join leads l on l.id = c.lead_id ${where(f)} order by c.started_at desc limit 20000`))];
}
