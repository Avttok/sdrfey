"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { callScripts, db } from "@/db";
import { requireUser } from "@/modules/auth/guard";

const step = z.object({
  id: z.string().max(40), title: z.string().max(120), mood: z.string().max(20), say: z.string().max(1500),
  answer: z.string().max(160).nullable(), kind: z.enum(["ok", "objecao", "neutro"]).nullable(),
});
const run = z.object({
  runId: z.string().uuid(), scriptId: z.number().int().nullable(), scriptTitle: z.string().max(160), goal: z.string().max(20), segment: z.string().max(40),
  contactName: z.string().max(120).nullable(), steps: z.array(step).min(1).max(120), notes: z.array(z.string().max(200)).max(40),
  outcome: z.string().max(20).nullable(), finished: z.boolean(), isTest: z.boolean().optional(),
});
export type ScriptRunInput = z.infer<typeof run>;

/** Guarda (ou atualiza) o andamento do roteiro de uma ligação. Chamado enquanto a conversa acontece e ao terminar. */
export async function saveScriptRunAction(leadId: number, input: ScriptRunInput): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const p = run.safeParse(input);
  if (!p.success || !Number.isInteger(leadId)) return { ok: false };
  const d = p.data;
  await db.insert(callScripts).values({ runId: d.runId, leadId, userId: me.id, scriptId: d.scriptId, scriptTitle: d.scriptTitle, goal: d.goal, segment: d.segment, contactName: d.contactName, steps: d.steps, notes: d.notes, outcome: d.outcome, finished: d.finished, isTest: !!d.isTest })
    .onConflictDoUpdate({ target: callScripts.runId, set: { steps: d.steps, notes: d.notes, outcome: d.outcome, finished: d.finished, contactName: d.contactName, updatedAt: sql`now()` }, setWhere: sql`${callScripts.userId} = ${me.id}` });
  return { ok: true };
}
