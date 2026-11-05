import { eq } from "drizzle-orm";
import { db, leadChannels, leads, leadTags, tagGroups, tags } from "@/db";
import { TAG } from "@/config/tags";
import { logAudit } from "@/modules/audit/log";
import { setLeadTags } from "@/modules/tags/apply";
import { slugify } from "@/modules/import/normalize";
import { classifyCapital, classifyPorte } from "./classify";
import { mergeInfo, parseBrasilApi, parseReceitaWs, statusToSituation, type CnpjInfo } from "./parse";

export type EnrichResult = {
  /** ok = ao menos uma fonte respondeu; unavailable = nenhuma respondeu (tente atualizar). */
  state: "ok" | "unavailable";
  sources: { brasilapi: "ok" | "falhou" | "dispensada"; receitaws: "ok" | "falhou" };
  /** Motivo quando uma fonte falha (ex.: "HTTP 429", "tempo esgotado"). */
  why: { brasilapi?: string; receitaws?: string };
  info: CnpjInfo | null;
  newPhones: number;
  newEmails: number;
  autoDiscarded: boolean;
};

const UA = "Mozilla/5.0 (compatible; SDRFEY/1.0; +https://sdr-fey.vercel.app)";

/** Consulta com identificação, tempo maior e até 3 tentativas (a BrasilAPI às vezes demora ou limita). */
async function getJson(url: string): Promise<{ data: unknown | null; why?: string }> {
  let why = "sem resposta";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800 * attempt));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: "application/json", "user-agent": UA }, cache: "no-store" });
      if (res.ok) return { data: await res.json() };
      why = `HTTP ${res.status}`;
      if (res.status === 404 || res.status === 400) break; // CNPJ inexistente: repetir não adianta
    } catch (e) {
      why = e instanceof Error && e.name === "TimeoutError" ? "tempo esgotado" : "falha de conexão";
    }
  }
  return { data: null, why };
}

/** Garante a tag (porte/capital nascem sob demanda, como na importação) e devolve o par grupo:chave. */
async function ensureAutoTag(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], group: string, label: string, sort = 0) {
  const key = slugify(label);
  const [g] = await tx.select({ key: tagGroups.key }).from(tagGroups).where(eq(tagGroups.key, group));
  if (!g || !key) return null;
  await tx.insert(tags).values({ groupKey: group, key, label, sort }).onConflictDoNothing();
  return { group, key };
}

/**
 * Consulta BrasilAPI e ReceitaWS, guarda cada resposta crua separada, soma telefones/e-mails novos
 * e, se a empresa não estiver ATIVA, desqualifica e descarta automaticamente.
 */
export async function enrichLead(leadId: number, userId: number | null = null): Promise<EnrichResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead não encontrado.");

  /* ReceitaWS primeiro; a BrasilAPI só é consultada se a ReceitaWS falhar ou não trouxer dados (mais rápido) */
  const { data: rw, why: whyW } = await getJson(`https://receitaws.com.br/v1/cnpj/${lead.cnpj}`);
  const b = parseReceitaWs(rw);
  let rb: unknown | null = null;
  let whyB: string | undefined;
  if (!b) ({ data: rb, why: whyB } = await getJson(`https://brasilapi.com.br/api/cnpj/v1/${lead.cnpj}`));
  const a = parseBrasilApi(rb);
  const info = mergeInfo(a, b);
  const result: EnrichResult = {
    state: info ? "ok" : "unavailable",
    sources: { brasilapi: a ? "ok" : b ? "dispensada" : "falhou", receitaws: b ? "ok" : "falhou" },
    why: { ...(a || b ? {} : { brasilapi: whyB ?? "resposta sem dados" }), ...(b ? {} : { receitaws: whyW ?? "resposta sem dados" }) },
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
      meta: { telefonesNovos: result.newPhones, emailsNovos: result.newEmails, fontes: result.sources, motivos: result.why },
    });

    /* porte e capital social viram tags sozinhos, como na planilha antiga */
    const auto: { group: string; key: string }[] = [];
    const porte = classifyPorte({ porte: info.porte, activity: info.activity, capital: info.capital, nature: info.nature, isMei: info.isMei });
    if (porte) { const t = await ensureAutoTag(tx, TAG.group.porte, porte); if (t) auto.push(t); }
    const cap = classifyCapital(info.capital);
    if (cap) { const t = await ensureAutoTag(tx, TAG.group.capital, cap.label, cap.value); if (t) auto.push(t); }
    if (auto.length) await setLeadTags(tx, { leadId, userId: null, source: "auto", reason: "Consulta de CNPJ", add: auto });

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
