"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { restoreSeedScripts } from "./seed";

export async function restoreScriptsAction(mode: "unedited" | "all"): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  if (mode !== "unedited" && mode !== "all") return { ok: false, message: "Opção inválida." };
  const n = await restoreSeedScripts(mode);
  await logAudit(db, { userId: me.id, entity: "setting", action: mode === "all" ? "restaurou todos os roteiros de fábrica" : "atualizou roteiros de fábrica não editados", newValue: n });
  revalidatePath("/admin/roteiros"); revalidatePath("/scripts");
  return { ok: true, message: `${n} roteiro(s) atualizado(s).` };
}
