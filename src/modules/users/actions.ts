"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, users } from "@/db";
import { isChoosableAccent } from "@/config/theme";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";

/** Troca a cor da própria pessoa. Valor vazio volta para a cor padrão do cargo. */
export async function setAccentAction(formData: FormData) {
  const me = await requireUser();
  const raw = String(formData.get("accent") ?? "");
  const next = isChoosableAccent(raw) ? raw : null;
  if (next === me.accent) return;

  await db.update(users).set({ accent: next }).where(eq(users.id, me.id));
  await logAudit(db, {
    userId: me.id,
    entity: "user",
    action: "alterou",
    field: "cor do sistema",
    oldValue: me.accent,
    newValue: next,
  });
  revalidatePath("/", "layout");
}

/** Cada pessoa altera o próprio nome de exibição. O login (usuário) nunca muda. */
export async function setDisplayNameAction(name: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const next = name.trim().replace(/\s+/g, " ");
  if (next.length < 2 || next.length > 60) return { ok: false, message: "Use de 2 a 60 caracteres." };
  if (next === me.name) return { ok: true };
  await db.update(users).set({ name: next }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "nome de exibição", oldValue: me.name, newValue: next });
  revalidatePath("/", "layout");
  return { ok: true, message: "Nome atualizado." };
}
