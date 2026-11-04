import { eq } from "drizzle-orm";
import { db, leadChannels, leads, leadTags, tags } from "@/db";
import { TAG } from "@/config/tags";
import { logAudit } from "@/modules/audit/log";
import { setLeadTags } from "@/modules/tags/apply";
import { mergeInfo, parseBrasilApi, parseReceitaWs, statusToSituation, type CnpjInfo } from "./parse";

export type EnrichResult = {
  /** ok = ao menos uma fonte respondeu; unavailable = nenhuma respondeu (tente atualizar). */
  state: "ok" | "unavailable";
  sources: { brasilapi: "ok" | "falhou"; receitaws: "ok" | "falhou" };
  info: CnpjInfo | null;
  newPhones: number;
  newEmails: number;
  autoDiscarded: boolean;
};

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Consulta BrasilAPI e ReceitaWS, guarda cada resposta crua separada, soma telefones/e-mails novos
 * e, se a empresa não estiver ATIVA, desqualifica e descarta automaticamente.
 */
export async function enrichLead(leadId: number, userId: number | null = null): Promise<EnrichResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead não encontrado.");

  const [rb, rw] = await Promise.all([
    getJson(`https://brasilapi.com.br/api/cnpj/v1/${lead.cnpj}`),
    getJson(`https://receitaws.com.br/v1/cnpj/${lead.cnpj}`),
  ]);
  const a = parseBrasilApi(rb);
  const b = parseReceitaWs(rw);
  const info = mergeInfo(a, b);
  const result: EnrichResult = {
    state: info ? "ok" : "unavailable",
    sources: { brasilapi: a ? "ok" : "falhou", receitaws: b ? "ok" : "falhou" },
    info,
    newPhones: 0,
    newEmails: 0,
    autoDiscarded: false,
  };
  if (!info) return result;

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({
        ...(a ? { brasilApiData: rb } : {}),
        ...(b ? { receitaWsData: rw } : {}),
        tradeName: info.tradeName ?? lead.tradeName,
        city: info.city ?? lead.city,
        uf: info.uf ?? lead.uf,
        registrationStatus: info.status ?? lead.registrationStatus,
        enrichedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    const origin = (value: string, kind: "phone" | "email") =>
      (kind === "phone" ? a?.phones : a?.emails)?.includes(value) ? ("brasilapi" as const) : ("receitaws" as const);
    for (const value of info.phones) {
      const r = await tx.insert(leadChannels).values({ leadId, kind: "phone", value, origin: origin(value, "phone") }).onConflictDoNothing().returning({ id: leadChannels.id });
      result.newPhones += r.length;
    }
    for (const value of info.emails) {
      const r = await tx.insert(leadChannels).values({ leadId, kind: "email", value, origin: origin(value, "email") }).onConflictDoNothing().returning({ id: leadChannels.id });
      result.newEmails += r.length;
    }

    await logAudit(tx, {
      userId,
      leadId,
      entity: "lead",
      action: "atualizou dados pela Receita",
      field: "Situação cadastral",
      oldValue: lead.registrationStatus,
      newValue: info.status,
      meta: { telefonesNovos: result.newPhones, emailsNovos: result.newEmails, fontes: result.sources },
    });

    const situ = statusToSituation(info.status);
    if (situ) {
      const current = await tx.select({ key: tags.key }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).where(eq(leadTags.leadId, leadId));
      if (!current.some((t) => t.key === TAG.cliente)) {
        await setLeadTags(tx, {
          leadId,
          userId: null,
          source: "auto",
          reason: `Situação cadastral: ${info.status}`,
          add: [
            { group: TAG.group.situacao, key: situ },
            { group: TAG.group.qualificacao, key: TAG.desqualificado },
            { group: TAG.group.meio, key: TAG.bot },
          ],
        });
        result.autoDiscarded = true;
      }
    }
  });
  return result;
}
