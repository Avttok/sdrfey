import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, leads, tasks } from "@/db";
import type { TaskArea, TaskKind } from "@/config/tasks";

export type TaskRow = {
  id: number; area: TaskArea; userId: number; kind: TaskKind; title: string; note: string | null;
  dueAt: string | null; doneAt: string | null; createdAt: string; runId: string | null; fromScript: boolean;
  lead: { id: number; name: string; city: string | null; phone: string | null; contact: string | null } | null;
};

const cols = {
  id: tasks.id, area: tasks.area, userId: tasks.userId, kind: tasks.kind, title: tasks.title, note: tasks.note, dueAt: tasks.dueAt, doneAt: tasks.doneAt,
  createdAt: tasks.createdAt, runId: tasks.runId, leadId: leads.id, company: leads.company, tradeName: leads.tradeName, city: leads.city, phones: leads.phones, contactName: leads.contactName,
};
type Raw = { id: number; area: string; userId: number; kind: string; title: string; note: string | null; dueAt: Date | null; doneAt: Date | null; createdAt: Date; runId: string | null; leadId: number | null; company: string | null; tradeName: string | null; city: string | null; phones: string[] | null; contactName: string | null };
const shape = (r: Raw): TaskRow => ({
  id: r.id, area: r.area === "vendas" ? "vendas" : "sdr", userId: r.userId, kind: r.kind as TaskKind, title: r.title, note: r.note,
  dueAt: r.dueAt?.toISOString() ?? null, doneAt: r.doneAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), runId: r.runId, fromScript: !!r.runId,
  lead: r.leadId ? { id: r.leadId, name: r.tradeName || r.company || "Lead", city: r.city, phone: r.phones?.[0] ?? null, contact: r.contactName } : null,
});

/** Tarefas de uma pessoa numa janela: as abertas (todas) e as concluídas dos últimos 7 dias. */
export async function listTasks(userId: number, area: TaskArea): Promise<{ open: TaskRow[]; done: TaskRow[] }> {
  const base = db.select(cols).from(tasks).leftJoin(leads, eq(leads.id, tasks.leadId));
  const [open, done] = await Promise.all([
    base.where(and(eq(tasks.userId, userId), eq(tasks.area, area), isNull(tasks.doneAt))).orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.id)).limit(500),
    db.select(cols).from(tasks).leftJoin(leads, eq(leads.id, tasks.leadId))
      .where(and(eq(tasks.userId, userId), eq(tasks.area, area), isNotNull(tasks.doneAt), gte(tasks.doneAt, sql`now() - interval '7 days'`))).orderBy(desc(tasks.doneAt)).limit(100),
  ]);
  return { open: (open as Raw[]).map(shape), done: (done as Raw[]).map(shape) };
}

/** Tarefas geradas por uma ligação (para a pessoa ajustar na hora). */
export async function runTasks(userId: number, runId: string): Promise<TaskRow[]> {
  const rows = await db.select(cols).from(tasks).leftJoin(leads, eq(leads.id, tasks.leadId)).where(and(eq(tasks.userId, userId), eq(tasks.runId, runId))).orderBy(asc(tasks.id));
  return (rows as Raw[]).map(shape);
}

/** Quantas tarefas abertas estão atrasadas ou são de hoje, por janela (selo do menu). */
export async function dueCounts(userId: number): Promise<{ sdr: number; vendas: number }> {
  const rows = await db.select({ area: tasks.area, n: sql<number>`count(*)::int` }).from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.doneAt), isNotNull(tasks.dueAt), lt(tasks.dueAt, sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'`)))
    .groupBy(tasks.area);
  const out = { sdr: 0, vendas: 0 };
  for (const r of rows) if (r.area === "vendas") out.vendas = r.n; else out.sdr = r.n;
  return out;
}
