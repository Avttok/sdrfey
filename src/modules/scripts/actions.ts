"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, scripts } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import type { ScriptNode } from "@/config/scripts";
import { checkTree, scriptInput } from "./schema";

const fail = (message: string): ActionResult => ({ ok: false, message });
const refresh = () => { revalidatePath("/scripts"); revalidatePath("/atender"); revalidatePath("/shuffler-vendas"); };

/** Salva um script. Cada pessoa mexe só nos seus; scripts globais (do time) só o Adm cria e altera. */
export async function saveScriptAction(input: unknown): Promise<ActionResult & { id?: number }> {
  const me = await requirePerm("tab.scripts");
  const p = scriptInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  const bad = checkTree(d.nodes as ScriptNode[], d.startId);
  if (bad) return fail(bad);
  if (d.global && !me.isAdmin) return fail("Só o Adm cria scripts do time.");
  const values = { title: d.title, segment: d.segment, goal: d.goal, summary: d.summary ?? null, nodes: d.nodes, startId: d.startId, active: d.active ?? true, updatedAt: new Date() };
  if (d.id) {
    const [cur] = await db.select().from(scripts).where(eq(scripts.id, d.id));
    if (!cur) return fail("Script não encontrado.");
    const own = cur.ownerId === me.id;
    if (!own && !(me.isAdmin && cur.ownerId === null)) return fail("Você só pode alterar os seus scripts.");
    await db.update(scripts).set(values).where(eq(scripts.id, d.id));
    await logAudit(db, { userId: me.id, entity: "script", action: "alterou script", field: d.title });
    refresh();
    return { ok: true, message: "Script salvo.", id: d.id };
  }
  const [r] = await db.insert(scripts).values({ ...values, ownerId: d.global && me.isAdmin ? null : me.id }).returning({ id: scripts.id });
  await logAudit(db, { userId: me.id, entity: "script", action: "criou script", field: d.title });
  refresh();
  return { ok: true, message: "Script criado.", id: r.id };
}

export async function deleteScriptAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("tab.scripts");
  const [cur] = await db.select().from(scripts).where(eq(scripts.id, id));
  if (!cur) return fail("Script não encontrado.");
  if (cur.ownerId !== me.id && !(me.isAdmin && cur.ownerId === null)) return fail("Você só pode excluir os seus scripts.");
  await db.delete(scripts).where(and(eq(scripts.id, id)));
  await logAudit(db, { userId: me.id, entity: "script", action: "excluiu script", field: cur.title });
  refresh();
  return { ok: true, message: "Script excluído." };
}

/** Copia um script (do time ou seu) para a sua lista, para você poder editar sem mexer no original. */
export async function duplicateScriptAction(id: number): Promise<ActionResult & { id?: number }> {
  const me = await requirePerm("tab.scripts");
  const [cur] = await db.select().from(scripts).where(eq(scripts.id, id));
  if (!cur || (cur.ownerId !== null && cur.ownerId !== me.id) || (!cur.active && cur.ownerId === null && !me.isAdmin)) return fail("Script não encontrado.");
  const [r] = await db.insert(scripts).values({ ownerId: me.id, title: `${cur.title} (cópia)`.slice(0, 80), segment: cur.segment, goal: cur.goal, summary: cur.summary, nodes: cur.nodes, startId: cur.startId }).returning({ id: scripts.id });
  refresh();
  return { ok: true, message: "Cópia criada na sua lista.", id: r.id };
}
