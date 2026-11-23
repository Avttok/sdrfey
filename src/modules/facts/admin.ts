"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, fieldDefs, fieldSuggestions } from "@/db";
import { FIELD_GROUPS, FIELD_KEY_RE, keyFromLabel } from "@/config/facts";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { approveSuggestion, recomputePriorities, suggestFields } from "./intel";

const def = z.object({
  key: z.string().trim().optional(),
  label: z.string().trim().min(2, "Dê um nome ao campo.").max(60),
  kind: z.enum(["lista", "multi", "texto", "numero", "simnao"]),
  options: z.array(z.string().trim().min(1).max(60)).max(12),
  scope: z.enum(["lead", "person"]),
  groupName: z.string().refine((g) => (FIELD_GROUPS as readonly string[]).includes(g), "Grupo inválido."),
  ttlDays: z.number().int().min(7).max(1500).nullable(),
  priority: z.number().int().min(1).max(99),
  active: z.boolean(),
});

/** Cria ou edita um campo do catálogo. */
export async function saveFieldAction(input: z.input<typeof def>): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = def.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  const d = p.data;
  if ((d.kind === "lista" || d.kind === "multi") && d.options.length < 2) return { ok: false, message: "Informe pelo menos 2 opções." };
  const options = d.kind === "lista" || d.kind === "multi" ? [...new Set(d.options)] : [];
  const key = d.key && FIELD_KEY_RE.test(d.key) ? d.key : keyFromLabel(d.label);
  const [old] = await db.select({ key: fieldDefs.key }).from(fieldDefs).where(eq(fieldDefs.key, key)).limit(1);
  if (!old && d.key && d.key !== key) return { ok: false, message: "Código do campo inválido." };
  await db.insert(fieldDefs).values({ key, label: d.label, kind: d.kind, options, scope: d.scope, groupName: d.groupName, ttlDays: d.ttlDays, priority: d.priority, active: d.active, origin: "admin" })
    .onConflictDoUpdate({ target: fieldDefs.key, set: { label: d.label, kind: d.kind, options, scope: d.scope, groupName: d.groupName, ttlDays: d.ttlDays, priority: d.priority, active: d.active } });
  await logAudit(db, { userId: me.id, entity: "user", action: old ? "editou um campo de dados" : "criou um campo de dados", field: d.label });
  revalidatePath("/admin/campos");
  return { ok: true, message: old ? "Campo salvo." : "Campo criado." };
}

/** Roda a análise: reordena as prioridades pelo uso e procura campos novos nas observações. */
export async function analyzeFieldsAction(): Promise<ActionResult> {
  await requireAdmin();
  const [re, sug] = [await recomputePriorities(), await suggestFields()];
  revalidatePath("/admin/campos");
  return { ok: true, message: `${re} ${re === 1 ? "campo reordenado" : "campos reordenados"} e ${sug} ${sug === 1 ? "sugestão nova" : "sugestões novas"}.` };
}

export async function decideSuggestionAction(id: number, approve: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  if (approve) { if (!(await approveSuggestion(id))) return { ok: false, message: "Sugestão não encontrada." }; }
  else await db.update(fieldSuggestions).set({ status: "recusada" }).where(eq(fieldSuggestions.id, id));
  await logAudit(db, { userId: me.id, entity: "user", action: approve ? "aprovou um campo sugerido" : "recusou um campo sugerido", field: String(id) });
  revalidatePath("/admin/campos");
  return { ok: true, message: approve ? "Campo criado a partir da sugestão." : "Sugestão recusada." };
}
