import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db, scripts } from "@/db";
import type { ScriptDoc, ScriptGoal, ScriptNode } from "@/config/scripts";
import { ensureGlobalScripts } from "./seed";

type Row = typeof scripts.$inferSelect;
const toDoc = (r: Row, userId: number): ScriptDoc => ({ id: r.id, title: r.title, segment: r.segment, goal: r.goal as ScriptGoal, summary: r.summary, nodes: r.nodes as ScriptNode[], startId: r.startId, global: r.ownerId === null, mine: r.ownerId === userId, active: r.active });

/** Os scripts que a pessoa vê: os globais ativos e os dela. O Adm (all) vê todos os globais, inclusive os desativados. */
export async function listScripts(userId: number, opts: { all?: boolean } = {}): Promise<ScriptDoc[]> {
  await ensureGlobalScripts();
  const where = opts.all ? or(isNull(scripts.ownerId), eq(scripts.ownerId, userId)) : and(eq(scripts.active, true), or(isNull(scripts.ownerId), eq(scripts.ownerId, userId)));
  const rows = await db.select().from(scripts).where(where).orderBy(asc(scripts.goal), asc(scripts.segment), asc(scripts.id));
  return rows.map((r) => toDoc(r, userId));
}
