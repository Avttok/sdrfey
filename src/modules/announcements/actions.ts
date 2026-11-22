"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { announcements, db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";

const fail = (message: string): ActionResult => ({ ok: false, message });
const schema = z.object({
  id: z.number().int().optional(),
  title: z.string().trim().min(2, "Escreva o título do aviso.").max(90),
  body: z.string().trim().max(400),
  theme: z.enum(["urgente", "atencao", "aviso", "sucesso", "novidade"]),
  effect: z.enum(["auto", "none", "pulse", "shake", "shine"]),
  roles: z.array(z.enum(["user", "seller", "manager", "admin"])).max(4),
  active: z.boolean(),
  /** Quantas horas o aviso fica no ar (vazio = até desligar). */
  hours: z.number().int().min(1).max(24 * 90).nullable(),
});

export async function saveAnnouncementAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, hours, ...v } = p.data;
  const expiresAt = hours ? new Date(Date.now() + hours * 3600_000) : null;
  if (id) await db.update(announcements).set({ ...v, ...(hours !== null ? { expiresAt } : {}) }).where(eq(announcements.id, id));
  else await db.insert(announcements).values({ ...v, expiresAt, createdBy: me.id });
  await logAudit(db, { userId: me.id, entity: "setting", action: id ? "alterou aviso global" : "publicou aviso global", field: v.title });
  revalidatePath("/admin/avisos");
  return { ok: true, message: v.active ? "Aviso publicado: aparece para a equipe em até 1 minuto." : "Aviso salvo (desligado)." };
}

export async function deleteAnnouncementAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [a] = await db.delete(announcements).where(eq(announcements.id, id)).returning();
  if (!a) return fail("Aviso não encontrado.");
  await logAudit(db, { userId: me.id, entity: "setting", action: "excluiu aviso global", field: a.title });
  revalidatePath("/admin/avisos");
  return { ok: true, message: "Aviso excluído." };
}
