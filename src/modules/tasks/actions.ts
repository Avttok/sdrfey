"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, tasks } from "@/db";
import { TASK_KEYS, dueFromDays, fromLocalInput } from "@/config/tasks";
import { requireUser } from "@/modules/auth/guard";
import { runTasks, type TaskRow } from "./queries";

const refresh = () => { revalidatePath("/tarefas"); revalidatePath("/tarefas-vendas"); };
const kind = z.enum(TASK_KEYS as [string, ...string[]]);
const when = z.string().max(20).nullable();
const dueOf = (s: string | null | undefined): Date | null | undefined => (s === undefined ? undefined : s === null || s === "" ? null : fromLocalInput(s));

const createInput = z.object({ area: z.enum(["sdr", "vendas"]), kind, title: z.string().trim().min(2, "Dê um nome à tarefa.").max(120), due: when, leadId: z.number().int().nullable().optional(), note: z.string().trim().max(300).nullish() });
/** Tarefa criada à mão na janela de Tarefas (ou a partir de um lead). */
export async function createTaskAction(raw: unknown): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const p = createInput.safeParse(raw);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Confira os campos." };
  const d = p.data;
  const due = dueOf(d.due);
  if (due === null && d.due) return { ok: false, message: "Data inválida." };
  await db.insert(tasks).values({ area: d.area, userId: me.id, leadId: d.leadId ?? null, kind: d.kind, title: d.title, note: d.note || null, dueAt: due ?? null });
  refresh();
  return { ok: true };
}

const patchInput = z.object({ title: z.string().trim().min(2).max(120).optional(), kind: kind.optional(), due: when.optional(), note: z.string().trim().max(300).nullable().optional(), done: z.boolean().optional() });
/** Muda o nome, o tipo, a data ou o andamento de uma tarefa sua. */
export async function updateTaskAction(id: number, raw: unknown): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const p = patchInput.safeParse(raw);
  if (!p.success || !Number.isInteger(id)) return { ok: false, message: "Confira os campos." };
  const d = p.data;
  const set: Partial<typeof tasks.$inferInsert> = {};
  if (d.title !== undefined) set.title = d.title;
  if (d.kind !== undefined) set.kind = d.kind;
  if (d.note !== undefined) set.note = d.note || null;
  if (d.due !== undefined) { const due = dueOf(d.due); if (due === null && d.due) return { ok: false, message: "Data inválida." }; set.dueAt = due ?? null; }
  if (d.done !== undefined) set.doneAt = d.done ? new Date() : null;
  if (!Object.keys(set).length) return { ok: true };
  const r = await db.update(tasks).set(set).where(and(eq(tasks.id, id), eq(tasks.userId, me.id))).returning({ id: tasks.id });
  refresh();
  return r.length ? { ok: true } : { ok: false, message: "Tarefa não encontrada." };
}

/** Adia: para daqui a N dias (9h; fim de semana vai para segunda) ou para um dia exato. */
export async function snoozeTaskAction(id: number, days: number): Promise<{ ok: boolean }> {
  const me = await requireUser();
  if (!Number.isInteger(id) || !Number.isFinite(days) || days < 0 || days > 365) return { ok: false };
  const r = await db.update(tasks).set({ dueAt: dueFromDays(days) }).where(and(eq(tasks.id, id), eq(tasks.userId, me.id))).returning({ id: tasks.id });
  refresh();
  return { ok: r.length > 0 };
}

export async function deleteTaskAction(id: number): Promise<{ ok: boolean }> {
  const me = await requireUser();
  if (!Number.isInteger(id)) return { ok: false };
  const r = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, me.id))).returning({ id: tasks.id });
  refresh();
  return { ok: r.length > 0 };
}

/** Tarefas que uma ligação gerou (a tela de fim da ligação mostra para a pessoa ajustar). */
export async function runTasksAction(runId: string): Promise<TaskRow[]> {
  const me = await requireUser();
  if (!z.string().uuid().safeParse(runId).success) return [];
  return runTasks(me.id, runId);
}
