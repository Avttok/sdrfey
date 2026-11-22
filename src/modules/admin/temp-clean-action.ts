"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { cleanTemp } from "./temp-clean";

/** Limpeza rápida dos temporários (botão do Apagar). Fica no Registro. */
export async function cleanTempAction(): Promise<ActionResult> {
  const me = await requireAdmin();
  const done = await cleanTemp(db);
  const total = Object.values(done).reduce((a, b) => a + b, 0);
  await logAudit(db, { userId: me.id, entity: "purge", action: "limpou temporários", field: "Limpeza rápida", newValue: `${total} registro(s)`, meta: { apagados: done } });
  revalidatePath("/admin/apagar");
  return { ok: true, message: total ? `Limpeza feita: ${total.toLocaleString("pt-BR")} registro(s) temporário(s) removido(s).` : "Já estava tudo limpo." };
}
