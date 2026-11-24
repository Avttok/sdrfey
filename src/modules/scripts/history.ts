import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { CallScriptStep } from "@/db/schema";
import type { TaskArea } from "@/config/tasks";

/** Situação de um roteiro no histórico. */
export type RunStatus = "parado" | "agendado" | "convertido" | "cotacao" | "indicacao" | "encerrado" | "concluido";
export const RUN_STATUS: Record<RunStatus, { label: string; tone: "ok" | "warn" | "bad" | "info" | "muted" }> = {
  convertido: { label: "Convertido", tone: "ok" },
  agendado: { label: "Agendado", tone: "info" },
  cotacao: { label: "Cotação", tone: "info" },
  indicacao: { label: "Indicação", tone: "ok" },
  concluido: { label: "Concluído", tone: "muted" },
  encerrado: { label: "Encerrado", tone: "bad" },
  parado: { label: "Parado no meio", tone: "warn" },
};
export const RUN_ORDER: RunStatus[] = ["convertido", "agendado", "cotacao", "indicacao", "concluido", "encerrado", "parado"];

const STATUS_SQL = sql`case
  when not c.finished then 'parado'
  when c.outcome = 'venda' then 'convertido'
  when c.outcome in ('visita','retorno') then 'agendado'
  when c.outcome = 'cotacao' then 'cotacao'
  when c.outcome = 'indicacao' then 'indicacao'
  when c.outcome = 'encerrar' then 'encerrado'
  else 'concluido' end`;

export type RunRow = {
  id: number; leadId: number; company: string; scriptTitle: string; goal: string; contactName: string | null; userName: string;
  status: RunStatus; outcome: string | null; startedAt: string; updatedAt: string; seconds: number; steps: CallScriptStep[]; notes: string[];
};
export type RunHistory = {
  total: number; byStatus: Record<RunStatus, number>; skipped: number;
  byScript: { title: string; runs: number; converted: number; scheduled: number; stopped: number }[];
  rows: RunRow[]; hasMore: boolean;
};

const areaSql = (area: TaskArea) => (area === "sdr" ? sql`c.goal = 'sdr'` : sql`c.goal <> 'sdr'`);

/** Todos os roteiros da pessoa na área (SDR ou Vendas), do mais novo ao mais antigo, com os números do painel. */
export async function runHistory(userId: number, area: TaskArea, o: { status: RunStatus | null; days: number | null; limit: number }): Promise<RunHistory> {
  const since = o.days ? sql`and c.started_at >= now() - (${o.days} * interval '1 day')` : sql``;
  const base = sql`from call_scripts c where c.user_id = ${userId} and not c.is_test and ${areaSql(area)} ${since}`;
  const [stat, scr, skip, list] = await Promise.all([
    db.execute<{ s: RunStatus; n: number }>(sql`select ${STATUS_SQL} as s, count(*)::int as n ${base} group by 1`),
    db.execute<{ title: string; runs: number; converted: number; scheduled: number; stopped: number }>(sql`select c.script_title as title, count(*)::int as runs,
      count(*) filter (where c.finished and c.outcome = 'venda')::int as converted,
      count(*) filter (where c.finished and c.outcome in ('visita','retorno'))::int as scheduled,
      count(*) filter (where not c.finished)::int as stopped ${base} group by 1 order by 2 desc limit 8`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from lead_skips s where s.user_id = ${userId} and s.until > now()`),
    db.execute<{ id: number; lead_id: number; company: string; script_title: string; goal: string; contact_name: string | null; user_name: string; status: RunStatus; outcome: string | null; started_at: Date; updated_at: Date; secs: number; steps: CallScriptStep[]; notes: string[] }>(sql`
      select c.id, c.lead_id, coalesce(l.trade_name, l.company) as company, c.script_title, c.goal, c.contact_name, u.name as user_name, ${STATUS_SQL} as status, c.outcome,
        c.started_at, c.updated_at, greatest(0, extract(epoch from (c.updated_at - c.started_at)))::int as secs, c.steps, c.notes
      from call_scripts c join leads l on l.id = c.lead_id join users u on u.id = c.user_id
      where c.user_id = ${userId} and not c.is_test and ${areaSql(area)} ${since} ${o.status ? sql`and ${STATUS_SQL} = ${o.status}` : sql``}
      order by c.started_at desc limit ${o.limit + 1}`),
  ]);
  const byStatus = Object.fromEntries(RUN_ORDER.map((k) => [k, 0])) as Record<RunStatus, number>;
  for (const r of stat) byStatus[r.s] = r.n;
  const rows = [...list].slice(0, o.limit).map((r) => ({
    id: r.id, leadId: r.lead_id, company: r.company, scriptTitle: r.script_title, goal: r.goal, contactName: r.contact_name, userName: r.user_name, status: r.status, outcome: r.outcome,
    startedAt: new Date(r.started_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(), seconds: r.secs, steps: r.steps ?? [], notes: r.notes ?? [],
  }));
  return { total: RUN_ORDER.reduce((a, k) => a + byStatus[k], 0), byStatus, skipped: skip[0]?.n ?? 0, byScript: [...scr], rows, hasMore: list.length > o.limit };
}
