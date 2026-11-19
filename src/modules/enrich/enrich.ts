import { eq, sql } from "drizzle-orm";
import { db, enrichLog, leadChannels, leads, leadTags, tagGroups, tags } from "@/db";
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

/** Consulta com identificação e tempo limite curto (a pessoa está esperando). Falhou? Quem chama decide se tenta de novo. */
async function getJson(url: string): Promise<{ data: unknown | null; why?: string; final?: boolean }> {
  let why = "sem resposta";
  for (let attempt = 0; attempt < 1; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7_000), headers: { accept: "application/json", "user-agent": UA }, cache: "no-store" });
      if (res.ok) return { data: await res.json() };
      why = `HTTP ${res.status}`;
      if (res.status === 404 || res.status === 400) return { data: null, why, final: true }; // CNPJ inexistente: repetir não adianta
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
export type EnrichOrigin = "lote" | "cron" | "manual" | "auto" | "novo";

/** Consulta o CNPJ e registra o resultado no histórico (tela do Adm). */
export async function enrichLead(leadId: number, userId: number | null = null, origin: EnrichOrigin = "manual"): Promise<EnrichResult> {
  const t0 = Date.now();
  const log = async (ok: boolean, r?: EnrichResult, err?: string) => {
    try {
      const why = err ?? (r && !ok ? [r.why.brasilapi && `BrasilAPI: ${r.why.brasilapi}`, r.why.receitaws && `ReceitaWS: ${r.why.receitaws}`].filter(Boolean).join(" · ") : null);
      await db.insert(enrichLog).values({ leadId, origin, ok, ms: Date.now() - t0, userId, status: r?.info?.status ?? null, phones: r?.newPhones ?? 0, emails: r?.newEmails ?? 0, why: why ? why.slice(0, 300) : null });
    } catch { /* o histórico nunca derruba a consulta */ }
  };
  try {
    const r = await enrichCore(leadId, userId);
    await log(r.state === "ok", r);
    return r;
  } catch (e) { await log(false, undefined, e instanceof Error ? e.message : "erro"); throw e; }
  finally {
    /* consultado (com sucesso ou não): as negociações importadas deste lead já podem aparecer no kanban */
    try { await db.execute(sql`update deals set import_pending = false where lead_id = ${leadId} and import_pending`); } catch { /* nunca derruba a consulta */ }
  }
}

async function enrichCore(leadId: number, userId: number | null): Promise<EnrichResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead não encontrado.");

  /* As duas fontes ao mesmo tempo (antes uma esperava a outra, e as falhas somavam até 1 minuto). Se nenhuma responder, uma segunda rodada. */
  const rwUrl = `https://receitaws.com.br/v1/cnpj/${lead.cnpj}`;
  const bUrl = `https://brasilapi.com.br/api/cnpj/v1/${lead.cnpj}`;
  let [rwRes, bRes] = await Promise.all([getJson(rwUrl), getJson(bUrl)]);
  if (!parseReceitaWs(rwRes.data) && !parseBrasilApi(bRes.data) && !(rwRes.final && bRes.final)) {
    await new Promise((r) => setTimeout(r, 600));
    const [rw2, b2] = await Promise.all([rwRes.final ? rwRes : getJson(rwUrl), bRes.final ? bRes : getJson(bUrl)]);
    rwRes = rw2; bRes = b2;
  }
  const rw = rwRes.data, whyW = rwRes.why, rb = bRes.data, whyB = bRes.why;
  const b = parseReceitaWs(rw);
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
        /* lead que entrou só com o CNPJ (importação de negociações): passa a ter o nome da Receita */
        ...(/^CNPJ\s*\d*$/i.test(lead.company.trim()) || !lead.company.trim() ? { company: info.legalName ?? info.tradeName ?? lead.company } : {}),
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

/** Consulta a Receita (ReceitaWS e BrasilAPI) sem gravar nada: serve para pré-preencher um cadastro novo. */
export async function fetchCnpjInfo(cnpj: string): Promise<CnpjInfo | null> {
  const { data: rw } = await getJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
  const b = parseReceitaWs(rw);
  let rb: unknown | null = null;
  if (!b) ({ data: rb } = await getJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`));
  return mergeInfo(parseBrasilApi(rb), b);
}
