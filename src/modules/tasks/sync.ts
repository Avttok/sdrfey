import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, tasks } from "@/db";
import { dueFromDays, type TaskArea } from "@/config/tasks";

/** Usado pelo registro da ligação: cria as tarefas do caminho percorrido e tira as que deixaram de valer (voltou um passo). */
export async function syncRunTasks(input: { userId: number; leadId: number; area: TaskArea; runId: string; drafts: { key: string; kind: string; title: string; days: number }[] }): Promise<void> {
  const { userId, leadId, area, runId, drafts } = input;
  if (drafts.length) {
    await db.insert(tasks).values(drafts.map((t) => ({ area, userId, leadId, kind: t.kind, title: t.title, dueAt: dueFromDays(t.days), runId, runKey: t.key }))).onConflictDoNothing();
  }
  const keep = drafts.map((t) => t.key);
  await db.delete(tasks).where(and(eq(tasks.userId, userId), eq(tasks.runId, runId), isNull(tasks.doneAt), keep.length ? notInArray(tasks.runKey, keep) : sql`true`));
  try { revalidatePath("/tarefas"); revalidatePath("/tarefas-vendas"); } catch { /* fora de uma requisição */ }
}
