import { desc, eq } from "drizzle-orm";
import { callScripts, db, users } from "@/db";
import { bubbleHex } from "@/config/theme";

export type ScriptRunView = {
  id: number; scriptTitle: string; goal: string; segment: string; contactName: string | null; steps: (typeof callScripts.$inferSelect)["steps"]; notes: string[];
  outcome: string | null; finished: boolean; startedAt: string; updatedAt: string; by: { name: string; hex: string };
};

/** Roteiros usados nas ligações de um lead (os mais novos primeiro). Ligações de teste não entram. */
export async function getScriptRuns(leadId: number): Promise<ScriptRunView[]> {
  const rows = await db.select({ r: callScripts, name: users.name, accent: users.accent, roles: users.roles, uid: users.id }).from(callScripts).innerJoin(users, eq(users.id, callScripts.userId)).where(eq(callScripts.leadId, leadId)).orderBy(desc(callScripts.startedAt)).limit(30);
  return rows.filter((x) => !x.r.isTest).map((x) => ({ id: x.r.id, scriptTitle: x.r.scriptTitle, goal: x.r.goal, segment: x.r.segment, contactName: x.r.contactName, steps: x.r.steps, notes: x.r.notes, outcome: x.r.outcome, finished: x.r.finished, startedAt: x.r.startedAt.toISOString(), updatedAt: x.r.updatedAt.toISOString(), by: { name: x.name, hex: bubbleHex(x.accent, x.uid, x.roles ?? undefined) } }));
}
