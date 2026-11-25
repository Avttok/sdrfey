"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditLog, db, leads, tagGroups, tags } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { setLeadTags } from "@/modules/tags/apply";

/**
 * Desfaz uma alteração do Registro. Suporta o que dá para desfazer com segurança:
 * tags aplicadas/removidas e observação de lead. O resto mostra um aviso claro.
 */
export async function revertAuditAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("audit.revert");
  const [e] = await db.select().from(auditLog).where(eq(auditLog.id, id));
  if (!e) return { ok: false, message: "Registro não encontrado." };
  const [done] = await db.select({ id: auditLog.id }).from(auditLog).where(and(eq(auditLog.action, "reverteu"), sql`${auditLog.meta}->>'revertido' = ${String(id)}`));
  if (done) return { ok: false, message: "Esta alteração já foi revertida." };
  if (!e.leadId || e.entity !== "lead") return { ok: false, message: "Este tipo de registro não pode ser revertido automaticamente. Abra o item e corrija manualmente." };

  if (e.action === "aplicou tag" || e.action === "removeu tag") {
    const label = e.action === "aplicou tag" ? e.newValue : e.oldValue;
    const [g] = await db.select().from(tagGroups).where(eq(tagGroups.name, e.field ?? ""));
    const [t] = g ? await db.select().from(tags).where(and(eq(tags.groupKey, g.key), eq(tags.label, label ?? ""))) : [];
    if (!t) return { ok: false, message: "A tag deste registro não existe mais." };
    await db.transaction(async (tx) => {
      await setLeadTags(tx, { countHits: false, leadId: e.leadId!, userId: me.id, ...(e.action === "aplicou tag" ? { remove: [{ group: t.groupKey, key: t.key }] } : { add: [{ group: t.groupKey, key: t.key }] }), reason: `Reversão do registro ${id}` });
      await logAudit(tx, { userId: me.id, leadId: e.leadId, entity: "lead", action: "reverteu", field: e.field, meta: { revertido: id } });
    });
  } else if (e.field === "Observação") {
    await db.transaction(async (tx) => {
      await tx.update(leads).set({ notes: e.oldValue, updatedAt: new Date() }).where(eq(leads.id, e.leadId!));
      await logAudit(tx, { userId: me.id, leadId: e.leadId, entity: "lead", action: "reverteu", field: "Observação", oldValue: e.newValue, newValue: e.oldValue, meta: { revertido: id } });
    });
  } else {
    return { ok: false, message: "Este tipo de registro não pode ser revertido automaticamente. Abra o lead e corrija manualmente." };
  }
  revalidatePath("/registro");
  return { ok: true, message: "Alteração revertida e registrada." };
}
