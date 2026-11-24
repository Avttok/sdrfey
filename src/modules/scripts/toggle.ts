"use server";

import { revalidatePath } from "next/cache";
import { db, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { invalidateSettings } from "@/modules/settings/get";

/** Liga ou desliga o roteiro durante a ligação para todos de uma vez. */
export async function setRoteiroGlobalAction(on: boolean): Promise<{ ok: boolean }> {
  const me = await requireAdmin();
  await db.insert(settings).values({ key: "roteiro_on", value: on ? 1 : 0, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: on ? 1 : 0, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: on ? "ligou o roteiro durante a ligação para todos" : "desligou o roteiro durante a ligação para todos" });
  revalidatePath("/", "layout");
  return { ok: true };
}
