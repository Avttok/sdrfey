"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callScripts, db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";

/** Adm apaga um roteiro feito (uma linha do Histórico de roteiros). */
export async function deleteScriptRunAction(id: number): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  const [r] = await db.delete(callScripts).where(eq(callScripts.id, id)).returning();
  if (!r) return { ok: false, message: "Roteiro não encontrado." };
  await logAudit(db, { userId: me.id, leadId: r.leadId, entity: "script", action: "apagou roteiro feito", field: r.scriptTitle });
  revalidatePath("/tarefas"); revalidatePath("/tarefas-vendas"); revalidatePath(`/leads/${r.leadId}`);
  return { ok: true, message: "Roteiro apagado." };
}
