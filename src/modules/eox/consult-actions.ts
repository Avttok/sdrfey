"use server";

import { revalidatePath } from "next/cache";
import { db, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";
import { eoxConsultLead, loadConsultOptions } from "./consult";
import { CONSULT_KEY, parseConsult, type ConsultOptions } from "./consult-options";

/** Salva as opções da Consulta EOX (o que preencher, ritmo e campos extras). Só o Adm. */
export async function saveConsultOptionsAction(input: unknown): Promise<ActionResult & { options?: ConsultOptions }> {
  const me = await requireAdmin();
  const o = parseConsult(input);
  await db.insert(settings).values({ key: CONSULT_KEY, value: o, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: o, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou as opções da Consulta EOX", field: CONSULT_KEY, newValue: JSON.stringify(o).slice(0, 300) });
  revalidatePath("/admin/consulta-eox");
  return { ok: true, message: "Opções salvas.", options: o };
}

/** Consulta um lead na EOX agora (botão no perfil do lead). Só o Adm. */
export async function eoxConsultLeadAction(leadId: number): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!Number.isInteger(leadId)) return { ok: false, message: "Lead inválido." };
  const r = await eoxConsultLead(leadId, me.id, "manual", await loadConsultOptions());
  revalidatePath(`/leads/${leadId}`);
  if (!r.ok) return { ok: false, message: r.why ?? "A EOX não respondeu." };
  const parts = [r.newPhones && `${r.newPhones} telefone${r.newPhones > 1 ? "s" : ""}`, r.newEmails && `${r.newEmails} e-mail${r.newEmails > 1 ? "s" : ""}`, r.people && `${r.people} pessoa${r.people > 1 ? "s" : ""}`, r.filled && `${r.filled} campo${r.filled > 1 ? "s" : ""}`].filter(Boolean);
  return { ok: true, message: parts.length ? `EOX: ${parts.join(", ")} novos.` : "Achou na EOX, mas não havia nada novo." };
}
