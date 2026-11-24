import { eq, sql } from "drizzle-orm";
import { db, enrichLog, leadChannels, leads, leadTags, tagGroups, tags } from "@/db";
import { TAG } from "@/config/tags";
import { logAudit } from "@/modules/audit/log";
import { setLeadTags } from "@/modules/tags/apply";
import { slugify } from "@/modules/import/normalize";
import { classifyCapital, classifyPorte } from "./classify";
import { getSettings } from "@/modules/settings/get";
import { discoverSite, findPlace, scanSite } from "./web";
import { mergeInfo, parseBrasilApi, parsePhones, parseReceitaWs, statusToSituation, type CnpjInfo } from "./parse";

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

/** OpenCNPJ.org: telefones (sem fax) e e-mail da Receita. Só o que falta nas outras fontes. */
function parseOpenCnpj(j: unknown): { phones: string[]; emails: string[] } | null {
  if (!j || typeof j !== "object") return null;
  const o = j as { telefones?: { ddd?: string; numero?: string; is_fax?: boolean }[]; email?: unknown };
  const phones = (Array.isArray(o.telefones) ? o.telefones : []).filter((t) => t && !t.is_fax).flatMap((t) => parsePhones(`${t.ddd ?? ""}${t.numero ?? ""}`));
  const e = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  return { phones: [...new Set(phones)], emails: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? [e] : [] };
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
export async function enrichLead(leadId: number, userId: number | null = null, origin: EnrichOrigin = "manual", via?: "brasilapi" | "minhareceita"): Promise<EnrichResult> {
  const t0 = Date.now();
  const log = async (ok: boolean, r?: EnrichResult, err?: string) => {
    try {
      const why = err ?? (r && !ok ? [r.why.brasilapi && `BrasilAPI: ${r.why.brasilapi}`, r.why.receitaws && `ReceitaWS: ${r.why.receitaws}`].filter(Boolean).join(" · ") : null);
      await db.insert(enrichLog).values({ leadId, origin, ok, ms: Date.now() - t0, userId, status: r?.info?.status ?? null, phones: r?.newPhones ?? 0, emails: r?.newEmails ?? 0, why: why ? why.slice(0, 300) : null });
    } catch { /* o histórico nunca derruba a consulta */ }
  };
  try {
    const r = await enrichCore(leadId, userId, via);
    await log(r.state === "ok", r);
    return r;
  } catch (e) { await log(false, undefined, e instanceof Error ? e.message : "erro"); throw e; }
  finally {
    /* consultado (com sucesso ou não): as negociações importadas deste lead já podem aparecer no kanban */
    try { await db.execute(sql`update deals set import_pending = false where lead_id = ${leadId} and import_pending`); } catch { /* nunca derruba a consulta */ }
  }
}

async function enrichCore(leadId: number, userId: number | null, via?: "brasilapi" | "minhareceita"): Promise<EnrichResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead não encontrado.");

  /* As fontes ligadas no painel Adm, ao mesmo tempo (antes uma esperava a outra). Se nenhuma responder, uma segunda rodada. */
  const cfg = await getSettings();
  const rwUrl = `https://receitaws.com.br/v1/cnpj/${lead.cnpj}`;
  const bUrl = `https://brasilapi.com.br/api/cnpj/v1/${lead.cnpj}`;
  const off = { data: null, why: "desligada no painel", final: true };
  const call = (on: boolean, url: string) => (on ? getJson(url) : Promise.resolve(off));
  const fast = cfg.enrich_fast === 1;
  const useRw = !fast && cfg.enrich_receitaws === 1, useB = cfg.enrich_brasilapi === 1;
  const mrUrl = `https://minhareceita.org/${lead.cnpj}`;
  let rwRes: Awaited<ReturnType<typeof getJson>>, bRes: Awaited<ReturnType<typeof getJson>>;
  let open: { phones: string[]; emails: string[] } | null = null;
  if (fast) {
    /* Pesquisa Rápida: os CNPJs se dividem entre BrasilAPI e Minha Receita (cada uma serve de reserva da outra); a ReceitaWS fica para a fila. */
    const order = (via ? via === "brasilapi" : lead.id % 2 === 0) ? [bUrl, mrUrl] : [mrUrl, bUrl];
    rwRes = off;
    const [prim, oc] = await Promise.all([getJson(order[0]), getJson(`https://api.opencnpj.org/${lead.cnpj}`)]);
    bRes = prim;
    if (!parseBrasilApi(bRes.data) && !bRes.final) bRes = await getJson(order[1]);
    open = parseOpenCnpj(oc.data);
  } else {
    [rwRes, bRes] = await Promise.all([call(useRw, rwUrl), call(useB, bUrl)]);
    if ((useRw || useB) && !parseReceitaWs(rwRes.data) && !parseBrasilApi(bRes.data) && !(rwRes.final && bRes.final)) {
      await new Promise((r) => setTimeout(r, 600));
      const [rw2, b2] = await Promise.all([rwRes.final ? rwRes : call(useRw, rwUrl), bRes.final ? bRes : call(useB, bUrl)]);
      rwRes = rw2; bRes = b2;
    }
  }
  const rw = rwRes.data, whyW = rwRes.why, whyB = bRes.why;
  let rb = bRes.data;
  const b = parseReceitaWs(rw);
  let a = parseBrasilApi(rb);
  /* Reserva: a Minha Receita usa o mesmo formato da BrasilAPI e atende quando as duas fontes caem. */
  if (!a && !b && !fast && cfg.enrich_minhareceita === 1) {
    const m = await getJson(mrUrl);
    const pm = parseBrasilApi(m.data);
    if (pm) { a = pm; rb = m.data; }
  }
  let info = mergeInfo(a, b);
  if (info && open) info = { ...info, phones: [...new Set([...info.phones, ...open.phones])], emails: [...new Set([...info.emails, ...open.emails])] };
  /* Poucos telefones/e-mails? A Minha Receita (mesma base, outro servidor) completa o que faltar. */
  if (info && !fast && cfg.enrich_minhareceita === 1 && (info.phones.length < 2 || !info.emails.length)) {
    const m = await getJson(`https://minhareceita.org/${lead.cnpj}`);
    const pm = parseBrasilApi(m.data);
    if (pm) info = mergeInfo(info, pm);
  }
  const result: EnrichResult = {
    state: info ? "ok" : "unavailable",
    sources: { brasilapi: a ? "ok" : b ? "dispensada" : "falhou", receitaws: b ? "ok" : "falhou" },
    why: { ...(a || b ? {} : { brasilapi: whyB ?? "resposta sem dados" }), ...(b ? {} : { receitaws: whyW ?? "resposta sem dados" }) },
    info,
    newPhones: 0,
    newEmails: 0,
    autoDiscarded: false,
  };
  if (!info) { await enrichWeb(leadId, lead, cfg, result); return result.newPhones + result.newEmails > 0 ? { ...result, state: "ok" } : result; }

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
        /* endereço e e-mail só entram se o cadastro estiver em branco (o que a pessoa digitou nunca é trocado) */
        address: lead.address?.trim() ? lead.address : ([info.address.street, info.address.number, info.address.complement].filter(Boolean).join(", ") || lead.address),
        neighborhood: lead.neighborhood?.trim() ? lead.neighborhood : info.address.district ?? lead.neighborhood,
        zip: lead.zip?.trim() ? lead.zip : info.address.cep ? info.address.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : lead.zip,
        email: lead.email?.trim() ? lead.email : info.emails[0] ?? lead.email,
        registrationStatus: info.status ?? lead.registrationStatus,
        enrichedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    const origin = (value: string, kind: "phone" | "email") =>
      (kind === "phone" ? a?.phones : a?.emails)?.includes(value) ? ("brasilapi" as const) : (kind === "phone" ? open?.phones : open?.emails)?.includes(value) && !(kind === "phone" ? b?.phones : b?.emails)?.includes(value) ? ("opencnpj" as const) : ("receitaws" as const);
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
  await enrichWeb(leadId, lead, cfg, result);
  return result;
}


type Cfg = Awaited<ReturnType<typeof getSettings>>;

/**
 * Fontes extras da internet, se ligadas no painel Adm: Google Places (telefone e site) e o site da empresa, lido por inteiro
 * (página inicial + contato, sobre, unidades… + link na bio). Sem site cadastrado, tenta descobrir pelo domínio do e-mail e do nome,
 * só aceitando o que a página prova ser da empresa. Nunca derruba a consulta.
 */
async function enrichWeb(leadId: number, lead: typeof leads.$inferSelect, cfg: Cfg, result: EnrichResult): Promise<void> {
  if (cfg.enrich_places !== 1 && cfg.enrich_site !== 1) return;
  try {
    let site = lead.site, instagram = lead.instagram, facebook = lead.facebook, linkedin = lead.linkedin;
    const phones: { v: string; o: "google" | "site" }[] = [], emails: string[] = [];
    if (cfg.enrich_places === 1) {
      const pl = await findPlace(lead.tradeName ?? lead.company, lead.city ?? result.info?.city ?? null, lead.uf ?? result.info?.uf ?? null);
      if (pl?.phone) phones.push({ v: pl.phone, o: "google" });
      if (pl?.website && !site) site = pl.website;
    }
    if (cfg.enrich_site === 1 && !site) {
      const known = await db.select({ v: leadChannels.value }).from(leadChannels).where(sql`${leadChannels.leadId} = ${leadId} and ${leadChannels.kind} = 'email'`);
      site = await discoverSite({ emails: [lead.email ?? "", ...(result.info?.emails ?? []), ...known.map((k) => k.v)].filter(Boolean), names: [lead.tradeName, result.info?.tradeName, lead.company, result.info?.legalName], cnpj: lead.cnpj });
    }
    if (cfg.enrich_site === 1 && site) {
      const f = await scanSite(site);
      if (f) {
        for (const p of f.phones) phones.push({ v: p, o: "site" });
        emails.push(...f.emails);
        instagram ??= f.instagram; facebook ??= f.facebook; linkedin ??= f.linkedin;
      }
    }
    if (site !== lead.site || instagram !== lead.instagram || facebook !== lead.facebook || linkedin !== lead.linkedin) await db.update(leads).set({ site, instagram, facebook, linkedin, updatedAt: new Date() }).where(eq(leads.id, leadId));
    for (const p of phones) { const r = await db.insert(leadChannels).values({ leadId, kind: "phone", value: p.v, origin: p.o }).onConflictDoNothing().returning({ id: leadChannels.id }); result.newPhones += r.length; }
    for (const e of emails) { const r = await db.insert(leadChannels).values({ leadId, kind: "email", value: e, origin: "site" }).onConflictDoNothing().returning({ id: leadChannels.id }); result.newEmails += r.length; }
  } catch { /* fonte extra falhou: a consulta da Receita já valeu */ }
}

/** Consulta a Receita (ReceitaWS e BrasilAPI) sem gravar nada: serve para pré-preencher um cadastro novo. */
export async function fetchCnpjInfo(cnpj: string): Promise<CnpjInfo | null> {
  const { data: rw } = await getJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
  const b = parseReceitaWs(rw);
  let rb: unknown | null = null;
  if (!b) ({ data: rb } = await getJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`));
  return mergeInfo(parseBrasilApi(rb), b);
}


/** Fila da Pesquisa Rápida: leads já consultados que continuam sem NENHUM telefone ou e-mail (o OpenCNPJ já tentou) e que a ReceitaWS ainda não olhou. */
export const RW_QUEUE = sql`l.enriched_at is not null and l.rw_checked_at is null and l.receitaws_data is null and l.brasilapi_data is not null and not l.is_test
  and (l.registration_status is null or l.registration_status ilike 'ativ%')
  and not exists (select 1 from lead_channels c where c.lead_id = l.id and not c.wrong)`;

export async function rwQueueSize(): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from leads l where ${RW_QUEUE}`);
  return r?.n ?? 0;
}

/** Um passo da fila: a ReceitaWS aceita ~3 consultas por minuto, então só age se a última foi há 20 s. "wait" = ainda não deu o intervalo. */
export async function rwStep(): Promise<"did" | "wait" | "none"> {
  const [last] = await db.execute<{ s: number | null }>(sql`select extract(epoch from (now() - max(rw_checked_at)))::float as s from leads where rw_checked_at is not null`);
  const [next] = await db.execute<{ id: number; cnpj: string }>(sql`select l.id, l.cnpj from leads l where ${RW_QUEUE} order by l.id limit 1`);
  if (!next) return "none";
  if (last?.s != null && last.s < 20) return "wait";
  const res = await getJson(`https://receitaws.com.br/v1/cnpj/${next.cnpj}`);
  if (res.why === "HTTP 429") { await db.execute(sql`update leads set rw_checked_at = now() - interval '10 seconds' where id = ${next.id}`); return "wait"; }
  const info = parseReceitaWs(res.data);
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ rwCheckedAt: new Date(), ...(info ? { receitaWsData: res.data } : {}) }).where(eq(leads.id, next.id));
    if (!info) return;
    for (const value of info.phones) await tx.insert(leadChannels).values({ leadId: next.id, kind: "phone", value, origin: "receitaws" }).onConflictDoNothing();
    for (const value of info.emails) await tx.insert(leadChannels).values({ leadId: next.id, kind: "email", value, origin: "receitaws" }).onConflictDoNothing();
    if (info.emails[0]) await tx.execute(sql`update leads set email = ${info.emails[0]} where id = ${next.id} and coalesce(btrim(email), '') = ''`);
  });
  return "did";
}
