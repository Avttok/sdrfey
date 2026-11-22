import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
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

/**
 * Versão leve para a ligação: todos os scripts (título, tipo, fase) mas com os passos só do que vai ser usado
 * (a fase e o tipo de cliente do lead, o geral e os do próprio usuário). Os demais vêm sob demanda ao serem escolhidos.
 * Evita mandar ao navegador megabytes de passos que a ligação nunca usa.
 */
export async function listScriptsFor(userId: number, goal: ScriptGoal, segment: string | null): Promise<ScriptDoc[]> {
  await ensureGlobalScripts();
  const seg = segment ?? "geral";
  const rows = await db.select({
    id: scripts.id, title: scripts.title, segment: scripts.segment, goal: scripts.goal, summary: scripts.summary, startId: scripts.startId, ownerId: scripts.ownerId, active: scripts.active,
    nodes: sql<ScriptNode[]>`case when ${scripts.ownerId} = ${userId} or (${scripts.goal} = ${goal} and ${scripts.segment} in (${seg}, 'geral')) then ${scripts.nodes} else '[]'::jsonb end`,
  }).from(scripts).where(and(eq(scripts.active, true), or(isNull(scripts.ownerId), eq(scripts.ownerId, userId)))).orderBy(asc(scripts.goal), asc(scripts.segment), asc(scripts.id));
  return rows.map((r) => toDoc(r as Row, userId));
}

/** Um script inteiro (com os passos), se a pessoa pode vê-lo. */
export async function scriptById(userId: number, id: number): Promise<ScriptDoc | null> {
  const [r] = await db.select().from(scripts).where(and(eq(scripts.id, id), eq(scripts.active, true), or(isNull(scripts.ownerId), eq(scripts.ownerId, userId))));
  return r ? toDoc(r, userId) : null;
}
