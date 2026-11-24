"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callScripts, db } from "@/db";
import { requireAdmin } from "@/modules/auth/guard";

/** Apaga as ligações de teste do histórico de roteiros (só Adm). As ligações de verdade ficam. */
export async function purgeTestRunsAction(): Promise<{ ok: boolean; removed: number }> {
  await requireAdmin();
  const gone = await db.delete(callScripts).where(eq(callScripts.isTest, true)).returning({ id: callScripts.id });
  revalidatePath("/admin/roteiros/uso");
  return { ok: true, removed: gone.length };
}
