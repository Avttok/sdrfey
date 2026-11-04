import { and, eq, inArray } from "drizzle-orm";
import { leads, leadTags, tagGroups, tags } from "@/db";
import { logAudit, type DbOrTx } from "@/modules/audit/log";

export type TagChange = { group: string; key: string };

/**
 * ÚNICA porta para mudar tags de um lead. Respeita grupos exclusivos
 * (ex.: só uma temperatura) e registra cada mudança no histórico (de → para).
 * Devolve o que realmente mudou.
 */
export async function setLeadTags(
  db: DbOrTx,
  opts: {
    leadId: number;
    userId: number | null;
    add?: TagChange[];
    remove?: TagChange[];
    source?: "manual" | "auto";
    reason?: string;
  },
): Promise<{ added: string[]; removed: string[] }> {
  const { leadId, userId, add = [], remove = [], source = userId ? "manual" : "auto", reason } = opts;
  const groups = new Map((await db.select().from(tagGroups)).map((g) => [g.key, g]));
  const all = await db.select().from(tags);
  const byRef = new Map(all.map((t) => [`${t.groupKey}:${t.key}`, t]));
  const byId = new Map(all.map((t) => [t.id, t]));
  const current = await db.select({ tagId: leadTags.tagId }).from(leadTags).where(eq(leadTags.leadId, leadId));
  const have = new Set(current.map((c) => c.tagId));

  const toRemove = new Set<number>();
  const toAdd = new Set<number>();
  for (const r of remove) {
    const t = byRef.get(`${r.group}:${r.key}`);
    if (t && have.has(t.id)) toRemove.add(t.id);
  }
  for (const a of add) {
    const t = byRef.get(`${a.group}:${a.key}`);
    if (!t) throw new Error(`Tag desconhecida: ${a.group}:${a.key}`);
    if (have.has(t.id) && !toRemove.has(t.id)) continue;
    if (groups.get(a.group)?.exclusive) {
      for (const id of have) if (byId.get(id)?.groupKey === a.group && id !== t.id) toRemove.add(id);
    }
    toRemove.delete(t.id);
    if (!have.has(t.id)) toAdd.add(t.id);
  }

  if (toRemove.size) {
    await db.delete(leadTags).where(and(eq(leadTags.leadId, leadId), inArray(leadTags.tagId, [...toRemove])));
  }
  if (toAdd.size) {
    await db
      .insert(leadTags)
      .values([...toAdd].map((tagId) => ({ leadId, tagId, appliedBy: userId, source })))
      .onConflictDoNothing();
  }
  const label = (id: number) => `${groups.get(byId.get(id)!.groupKey)?.name}: ${byId.get(id)!.label}`;
  const added = [...toAdd].map(label);
  const removed = [...toRemove].map(label);
  if (added.length || removed.length) {
    await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
    await logAudit(db, [
      ...added.map((l) => ({ userId, leadId, entity: "lead" as const, action: "aplicou tag", field: l.split(": ")[0], oldValue: null, newValue: l.split(": ")[1], meta: reason ? { motivo: reason, origem: source } : { origem: source } })),
      ...removed.map((l) => ({ userId, leadId, entity: "lead" as const, action: "removeu tag", field: l.split(": ")[0], oldValue: l.split(": ")[1], newValue: null, meta: reason ? { motivo: reason, origem: source } : { origem: source } })),
    ]);
  }
  return { added, removed };
}
