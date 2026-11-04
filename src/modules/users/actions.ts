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
