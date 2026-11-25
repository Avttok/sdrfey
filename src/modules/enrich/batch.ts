import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSettings } from "@/modules/settings/get";
import { ENRICH_LISTS, normList } from "@/config/enrich-lists";
import { AGE_LISTS } from "./ages";
import { enrichLead, rwQueueSize, rwStep, RW_QUEUE } from "./enrich";

/** Lead que ainda não foi consultado e que não falhou nas últimas 6 horas. */
let retryH = 6;
const retry = () => sql`make_interval(hours => ${retryH})`;
const PENDING_ = () => sql`not l.is_test and l.enriched_at is null and (l.enrich_tried_at is null or l.enrich_tried_at < now() - ${retry()})`;

export type EnrichStats = { /** Pesquisa Rápida: leads esperando a ReceitaWS (e-mail e telefone) */ rwQueue: number; total: number; done: number; pending: number; failed: number; older: Record<number, number>; /** quantos leads há em cada lista (por chave) */ lists: Record<string, number>; /** não consultados por estado */ ufs: Record<string, number> };

const phoneOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong)`;
const emailOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'email' and not c.wrong)`;
const blank = (col: string) => sql.raw(`coalesce(btrim(l.${col}), '') = ''`);
/** Condição de cada lista (sem a trava de "não repetir logo"). */
const listCond = (key: string) => {
  if (key.startsWith("uf:")) return sql`l.enriched_at is null and l.uf = ${key.slice(3)}`;
  if (key.startsWith("age:")) return sql`l.enriched_at is not null and l.enriched_at < now() - make_interval(days => ${Number(key.slice(4))})`;
  switch (key) {
    case "deal_open": return sql`exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))`;
    case "no_phone": return sql`not ${phoneOk}`;
    case "no_email": return sql`not ${emailOk}`;
    case "no_contact": return sql`not ${phoneOk} and not ${emailOk}`;
    case "wrong_phone": return sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and c.wrong)`;
    case "no_person": return sql`${blank("contact_name")} and not exists (select 1 from lead_people p where p.lead_id = l.id)`;
    case "no_address": return sql`(${blank("address")} or ${blank("zip")})`;
    case "no_city": return sql`(${blank("city")} or ${blank("uf")})`;
    case "no_status": return sql`${blank("registration_status")}`;
    case "no_web": return sql`${blank("site")} and ${blank("instagram")} and ${blank("facebook")} and ${blank("linkedin")}`;
    case "fresh": return sql`l.enriched_at is null and l.created_at > now() - interval '7 days'`;
    case "unworked": return sql`l.enriched_at is null and not exists (select 1 from interactions i where i.lead_id = l.id)`;
    case "qualified": return sql`l.enriched_at is null and exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.key = 'qualificado')`;
    case "no_mobile": return sql`not exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong and length(regexp_replace(c.value, '[^0-9]', '', 'g')) >= 11)`;
    case "one_phone": return sql`(select count(*) from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong) = 1`;
    case "no_trade": return sql`${blank("trade_name")}`;
    case "retry_failed": return sql`l.enriched_at is null and l.enrich_tried_at is not null`;
    case "no_brasilapi": return sql`l.enriched_at is not null and l.brasilapi_data is null`;
    case "customers": return sql`exists (select 1 from deals d where d.lead_id = l.id and d.stage = 'ganho')`;
    case "contacted_stale": return sql`l.enriched_at is not null and l.enriched_at < now() - interval '30 days' and exists (select 1 from interactions i where i.lead_id = l.id)`;
    case "not_active": return sql`l.registration_status is not null and l.registration_status not ilike 'ativ%'`;
    default: return sql`true`;
  }
};
/** Lista "new" é a fila normal; as demais só pegam leads que não foram tentados há pouco (para não repetir o mesmo lead sem parar). */
const scopeWhere = (key: string) => key === "new" ? PENDING_() : sql`not l.is_test and (l.enrich_tried_at is null or l.enrich_tried_at < now() - ${retry()}) and ${listCond(key)}`;

export async function enrichStats(): Promise<EnrichStats> {
  retryH = (await getSettings()).enrich_retry_hours;
  const [r] = await db.execute<Record<string, number>>(sql`
    select count(*)::int as total,
      ${sql.join(AGE_LISTS.map((d) => sql`count(*) filter (where l.enriched_at is not null and l.enriched_at < now() - make_interval(days => ${d}))::int as ${sql.raw("o" + d)}`), sql`, `)},
      ${sql.join(ENRICH_LISTS.map((x, i) => sql`count(*) filter (where ${scopeWhere(x.key)})::int as ${sql.raw("l" + i)}`), sql`, `)},
      count(*) filter (where ${RW_QUEUE})::int as rwq,
      count(*) filter (where l.enriched_at is not null)::int as done,
      count(*) filter (where ${PENDING_()})::int as pending,
      count(*) filter (where l.enriched_at is null and l.enrich_tried_at is not null and l.enrich_tried_at >= now() - ${retry()})::int as failed
    from leads l where not l.is_test`);
  const ufRows = await db.execute<{ uf: string; n: number }>(sql`select l.uf, count(*)::int as n from leads l where ${PENDING_()} and l.uf ~ '^[A-Z]{2}$' group by 1 order by 2 desc`);
  const ufs = Object.fromEntries([...ufRows].map((u) => [u.uf, u.n]));
  const older: Record<number, number> = { 7: r?.o7 ?? 0, 14: r?.o14 ?? 0, 21: r?.o21 ?? 0, 30: r?.o30 ?? 0, 60: r?.o60 ?? 0, 90: r?.o90 ?? 0 };
  const lists = Object.fromEntries(ENRICH_LISTS.map((x, i) => [x.key, Number(r?.[`l${i}`] ?? 0)]));
  return { rwQueue: r?.rwq ?? 0, total: r?.total ?? 0, done: r?.done ?? 0, pending: r?.pending ?? 0, failed: r?.failed ?? 0, older, lists: { ...lists, ...Object.fromEntries(Object.entries(ufs).map(([u, n]) => [`uf:${u}`, n])) }, ufs };
}

/** Consulta até `max` leads, um de cada vez (as APIs gratuitas limitam o ritmo), parando quando passar de `budgetMs`. */
export async function enrichBatch(max: number, budgetMs = 25_000, userId: number | null = null, origin: "lote" | "cron" = "lote", listIn: number | string = "new"): Promise<{ tried: number; ok: number; failed: number; left: number }> {
  const t0 = Date.now();
  const list = normList(listIn);
  let tried = 0, ok = 0, failed = 0;
  const cfg0 = await getSettings();
  retryH = cfg0.enrich_retry_hours;
  const fast = cfg0.enrich_fast === 1;
  if (fast) {
    /* Pesquisa Rápida em massa: um bloco grande de leads, vários ao mesmo tempo (BrasilAPI e Minha Receita alternando, OpenCNPJ para e-mail e telefone,
       e a leitura do site de cada lead). A ReceitaWS só pega o que ficou sem nenhum contato, 1 por vez. */
    const big = max >= 100; // modo contínuo: um bloco de 100 por vez
    const n = big ? 100 : max <= 1 ? 30 : max * 3;
    const stop = t0 + Math.min(budgetMs, big ? 38_000 : 30_000);
    const rows = await db.execute<{ id: number }>(sql`select l.id from leads l where ${scopeWhere(list)} order by (exists (select 1 from deals d where d.lead_id = l.id and d.import_pending)) desc, ${list.startsWith("age:") ? sql`l.enriched_at asc` : sql`l.enrich_tried_at nulls first`}, md5(l.id::text) limit ${n}`);
    const ids = [...rows].map((r) => r.id);
    if (ids.length) await db.execute(sql`update leads set enrich_tried_at = now() where id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length && Date.now() < stop) {
        const i = cursor++;
        const id = ids[i];
        tried++;
        try { (await enrichLead(id, userId, origin, i % 2 === 0 ? "brasilapi" : "minhareceita")).state === "ok" ? ok++ : failed++; } catch { failed++; }
      }
    };
    await Promise.all([...Array.from({ length: 10 }, worker), rwDrain(ids.length ? 0 : budgetMs - (Date.now() - t0)).then((c) => { tried += c; ok += c; })]);
    // o que foi sorteado e não deu tempo de consultar volta para a fila agora
    if (cursor < ids.length) await db.execute(sql`update leads set enrich_tried_at = null where id in (${sql.join(ids.slice(Math.max(cursor, 0)).map((i) => sql`${i}`), sql`, `)}) and enriched_at is null`);
    if (ids.length && (await rwStep()) === "wait") { /* a ReceitaWS tem intervalo próprio */ }
    const stF = await enrichStats();
    return { tried, ok, failed, left: (stF.lists[list] ?? 0) + (await rwQueueSize()) };
  }
  while (tried < max && Date.now() - t0 < budgetMs) {
    const [next] = await db.execute<{ id: number }>(sql`select l.id from leads l where ${scopeWhere(list)} order by (exists (select 1 from deals d where d.lead_id = l.id and d.import_pending)) desc, ${list.startsWith("age:") ? sql`l.enriched_at asc` : sql`l.enrich_tried_at nulls first`}, md5(l.id::text) limit 1`);
    if (!next) {
      /* Pesquisa Rápida: sem CNPJ novo, usa o tempo para esvaziar a fila da ReceitaWS (e-mail e telefone) */
      if (fast) {
        const st = await rwStep();
        if (st === "did") { tried++; ok++; continue; }
        if (st === "wait") { await new Promise((r) => setTimeout(r, 4000)); tried++; continue; }
      }
      break;
    }
    tried++;
    // marca antes: se a consulta travar ou cair, este lead não bloqueia a fila
    await db.execute(sql`update leads set enrich_tried_at = now() where id = ${next.id}`);
    try { (await enrichLead(next.id, userId, origin)).state === "ok" ? ok++ : failed++; } catch { failed++; }
    if (fast) await rwStep();
    await new Promise((r) => setTimeout(r, fast ? 400 : 1200));
  }
  const st = await enrichStats();
  return { tried, ok, failed, left: (st.lists[list] ?? 0) + (fast ? await rwQueueSize() : 0) };
}

/** Esvazia a fila da ReceitaWS (1 por vez, no ritmo dela) até acabar o tempo. Devolve quantos fez. */
async function rwDrain(ms: number): Promise<number> {
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < ms) {
    const st = await rwStep();
    if (st === "none") break;
    if (st === "did") n++; else await new Promise((r) => setTimeout(r, 4000));
  }
  return n;
}

export async function autoEnrichOn(): Promise<boolean> {
  return (await getSettings()).auto_enrich === 1;
}


/** Negociações importadas esperando a consulta de CNPJ (ficam fora do kanban até lá). */
export async function pendingDealImports(): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from deals where import_pending and not is_test`);
  return r?.n ?? 0;
}

/** Consulta, um por vez, os leads das negociações importadas que ainda esperam. Quem falhar também é liberado (a consulta pode ser refeita depois). */
export async function enrichPendingDeals(max = 10, budgetMs = 40_000, userId: number | null = null): Promise<{ tried: number; ok: number; failed: number; left: number }> {
  const t0 = Date.now();
  let tried = 0, ok = 0, failed = 0;
  while (tried < max && Date.now() - t0 < budgetMs) {
    const [next] = await db.execute<{ id: number }>(sql`select distinct l.id from leads l join deals d on d.lead_id = l.id where d.import_pending and not d.is_test order by l.id limit 1`);
    if (!next) break;
    tried++;
    await db.execute(sql`update leads set enrich_tried_at = now() where id = ${next.id}`);
    try { (await enrichLead(next.id, userId, "novo")).state === "ok" ? ok++ : failed++; } catch { failed++; }
    await db.execute(sql`update deals set import_pending = false where lead_id = ${next.id}`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { tried, ok, failed, left: await pendingDealImports() };
}
