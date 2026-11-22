"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, emailTemplates } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { sanitizeHtml } from "./render";

const fail = (message: string): ActionResult => ({ ok: false, message });
const schema = z.object({ id: z.number().int().optional(), name: z.string().trim().min(1, "Informe o nome do modelo.").max(80), subject: z.string().trim().min(1, "Informe o assunto.").max(200), body: z.string().trim().min(1, "Escreva o texto.").max(20_000), bodyHtml: z.string().max(900_000, "O modelo ficou grande demais (imagens pesadas). Use uma imagem menor.").nullish(), active: z.boolean() });

/** Modelo de e-mail pessoal: só aparece para quem criou. */
export async function saveMyTemplateAction(input: unknown): Promise<ActionResult> {
  const me = await requirePerm("tab.email");
  const p = schema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, bodyHtml, ...rest } = p.data;
  const v = { ...rest, bodyHtml: bodyHtml ? sanitizeHtml(bodyHtml) : null };
  if (id) {
    const r = await db.update(emailTemplates).set(v).where(and(eq(emailTemplates.id, id), eq(emailTemplates.ownerId, me.id))).returning({ id: emailTemplates.id });
    if (!r.length) return fail("Você só pode alterar os seus modelos.");
  } else {
    await db.insert(emailTemplates).values({ ...v, ownerId: me.id });
    await logAudit(db, { userId: me.id, entity: "template", action: "criou modelo pessoal", field: v.name });
  }
  revalidatePath("/email");
  return { ok: true, message: "Modelo salvo." };
}

export async function deleteMyTemplateAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("tab.email");
  const r = await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.ownerId, me.id))).returning({ id: emailTemplates.id });
  if (!r.length) return fail("Modelo não encontrado.");
  revalidatePath("/email");
  return { ok: true, message: "Modelo excluído." };
}
