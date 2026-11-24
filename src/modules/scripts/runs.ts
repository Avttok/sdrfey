"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { callScripts, db, scripts } from "@/db";
import type { ScriptNode } from "@/config/scripts";
import { draftsFromSteps, type TaskArea } from "@/config/tasks";
import { syncRunTasks } from "@/modules/tasks/sync";
import { requireUser } from "@/modules/auth/guard";

const step = z.object({
  id: z.string().max(40), title: z.string().max(120), mood: z.string().max(20), say: z.string().max(1500),
  answer: z.string().max(160).nullable(), kind: z.enum(["ok", "objecao", "neutro"]).nullable(),
});
const run = z.object({
  runId: z.string().uuid(), scriptId: z.number().int().nullable(), scriptTitle: z.string().max(160), goal: z.string().max(20), segment: z.string().max(40), objective: z.string().max(20).nullable().optional(),
  contactName: z.string().max(120).nullable(), steps: z.array(step).min(1).max(120), notes: z.array(z.string().max(200)).max(40),
  outcome: z.string().max(20).nullable(), finished: z.boolean(), isTest: z.boolean().optional(),
});
export type ScriptRunInput = z.infer<typeof run>;

/** Guarda (ou atualiza) o andamento do roteiro de uma ligação. Chamado enquanto a conversa acontece e ao terminar. */
export async function saveScriptRunAction(leadId: number, input: ScriptRunInput, areaRaw?: string): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const p = run.safeParse(input);
  if (!p.success || !Number.isInteger(leadId)) return { ok: false };
  const d = p.data;
  await db.insert(callScripts).values({ runId: d.runId, leadId, userId: me.id, scriptId: d.scriptId, scriptTitle: d.scriptTitle, goal: d.goal, segment: d.segment, objective: d.objective ?? null, contactName: d.contactName, steps: d.steps, notes: d.notes, outcome: d.outcome, finished: d.finished, isTest: !!d.isTest })
    .onConflictDoUpdate({ target: callScripts.runId, set: { steps: d.steps, notes: d.notes, outcome: d.outcome, finished: d.finished, contactName: d.contactName, updatedAt: sql`now()` }, setWhere: sql`${callScripts.userId} = ${me.id}` });
  // As tarefas que o caminho gerou (ligar de novo, enviar e-mail…) aparecem na janela Tarefas da área.
  if (!d.isTest) {
    const area: TaskArea = areaRaw === "vendas" ? "vendas" : "sdr";
    let drafts: ReturnType<typeof draftsFromSteps> = [];
    if (d.finished && d.scriptId) {
      const [sc] = await db.select({ nodes: scripts.nodes }).from(scripts).where(eq(scripts.id, d.scriptId)).limit(1);
      if (sc) drafts = draftsFromSteps(sc.nodes as ScriptNode[], d.steps.map((x) => ({ id: x.id, answer: x.answer })));
    }
    await syncRunTasks({ userId: me.id, leadId, area, runId: d.runId, drafts }).catch(() => {});
  }
  return { ok: true };
}
