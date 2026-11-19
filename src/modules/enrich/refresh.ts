import { plural } from "@/lib/format";
import { enrichLead, type EnrichOrigin } from "./enrich";

export type RefreshResult = { ok: boolean; message: string };

/** Consulta o CNPJ e monta a mensagem para a pessoa (usada pela rota /api/enrich e pela ação de atualizar). */
export async function refreshInfo(leadId: number, userId: number, origin: EnrichOrigin = "manual"): Promise<RefreshResult> {
  const r = await enrichLead(leadId, userId, origin);
  const falhas = [r.why.brasilapi && `BrasilAPI: ${r.why.brasilapi}`, r.why.receitaws && `ReceitaWS: ${r.why.receitaws}`].filter(Boolean).join(" · ");
  if (r.state === "unavailable") return { ok: false, message: `Consulta indisponível agora (${falhas}). Tente atualizar de novo em instantes.` };
  const extra = r.newPhones + r.newEmails;
  return { ok: true, message: extra ? `Dados atualizados: ${plural(r.newPhones, "telefone novo", "telefones novos")} e ${plural(r.newEmails, "e-mail novo", "e-mails novos")}.` : `Dados atualizados. Nenhum contato novo.${falhas ? ` Atenção — ${falhas}.` : ""}` };
}
