"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, productTerms, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";
import { SEGMENT_WORDS } from "@/config/lists";

const fail = (message: string): ActionResult => ({ ok: false, message });
const refresh = () => { revalidatePath("/admin/nomenclatura"); revalidatePath("/admin/vendas"); };

const termSchema = z.object({
  id: z.number().int().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,8}$/, "A sigla usa só letras e números (até 8)."),
  meaning: z.string().trim().min(2, "Escreva o significado.").max(60),
  category: z.string().trim().min(1).max(30),
  note: z.string().trim().max(200).nullish(),
  active: z.boolean(),
});

export async function saveTermAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = termSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, ...v } = p.data;
  const [dup] = await db.select({ id: productTerms.id }).from(productTerms).where(eq(productTerms.code, v.code));
  if (dup && dup.id !== id) return fail(`A sigla ${v.code} já está cadastrada.`);
  if (id) await db.update(productTerms).set({ ...v, note: v.note ?? null }).where(eq(productTerms.id, id));
  else await db.insert(productTerms).values({ ...v, note: v.note ?? null });
  await logAudit(db, { userId: me.id, entity: "setting", action: id ? "alterou sigla de produto" : "criou sigla de produto", field: v.code, newValue: v.meaning });
  refresh();
  return { ok: true, message: `${v.code} = ${v.meaning} salvo.` };
}

export async function deleteTermAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [t] = await db.delete(productTerms).where(eq(productTerms.id, id)).returning();
  if (!t) return fail("Sigla não encontrada.");
  await logAudit(db, { userId: me.id, entity: "setting", action: "excluiu sigla de produto", field: t.code });
  refresh();
  return { ok: true, message: "Sigla excluída." };
}

/** Sugestões escritas à mão por segmento ("Posto de molas costuma comprar…"). Somam-se ao que o sistema aprende das cotações. */
export async function saveSegmentRecosAction(raw: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.record(z.string(), z.array(z.string().trim().min(2).max(80)).max(12)).safeParse(raw);
  if (!p.success) return fail("Confira as sugestões: cada uma com 2 a 80 letras.");
  const clean = Object.fromEntries(Object.entries(p.data).filter(([k, v]) => k in SEGMENT_WORDS && v.length));
  await db.insert(settings).values({ key: "segment_recos", value: clean, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: clean, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou sugestões de produtos por segmento", field: "segment_recos" });
  refresh();
  return { ok: true, message: "Sugestões salvas. Aparecem no Shuffler." };
}
