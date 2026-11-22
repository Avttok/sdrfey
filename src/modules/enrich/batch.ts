import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSettings } from "@/modules/settings/get";
import { ENRICH_LISTS, normList } from "@/config/enrich-lists";
import { AGE_LISTS } from "./ages";
import { enrichLead } from "./enrich";

/** Lead que ainda não foi consultado e que não falhou nas últimas 6 horas. */
let retryH = 6;
const retry = () => sql`make_interval(hours => ${retryH})`;
const PENDING_ = () => sql`not l.is_test and l.enriched_at is null and (l.enrich_tried_at is null or l.enrich_tried_at < now() - ${retry()})`;

export type EnrichStats = { total: number; done: number; pending: number; failed: number; older: Record<number, number>; /** quantos leads há em cada lista (por chave) */ lists: Record<string, number> };

const phoneOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong)`;
const emailOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'email' and not c.wrong)`;
const blank = (col: string) => sql.raw(`coalesce(btrim(l.${col}), '') = ''`);
/** Condição de cada lista (sem a trava de "não repetir logo"). */
const listCond = (key: string) => {
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
      count(*) filter (where l.enriched_at is not null)::int as done,
      count(*) filter (where ${PENDING_()})::int as pending,
      count(*) filter (where l.enriched_at is null and l.enrich_tried_at is not null and l.enrich_tried_at >= now() - ${retry()})::int as failed
    from leads l where not l.is_test`);
  const older: Record<number, number> = { 7: r?.o7 ?? 0, 14: r?.o14 ?? 0, 21: r?.o21 ?? 0, 30: r?.o30 ?? 0, 60: r?.o60 ?? 0, 90: r?.o90 ?? 0 };
  const lists = Object.fromEntries(ENRICH_LISTS.map((x, i) => [x.key, Number(r?.[`l${i}`] ?? 0)]));
  return { total: r?.total ?? 0, done: r?.done ?? 0, pending: r?.pending ?? 0, failed: r?.failed ?? 0, older, lists };
}

/** Consulta até `max` leads, um de cada vez (as APIs gratuitas limitam o ritmo), parando quando passar de `budgetMs`. */
export async function enrichBatch(max: number, budgetMs = 25_000, userId: number | null = null, origin: "lote" | "cron" = "lote", listIn: number | string = "new"): Promise<{ tried: number; ok: number; failed: number; left: number }> {
  const t0 = Date.now();
  const list = normList(listIn);
  let tried = 0, ok = 0, failed = 0;
  retryH = (await getSettings()).enrich_retry_hours;
  while (tried < max && Date.now() - t0 < budgetMs) {
    const [next] = await db.execute<{ id: number }>(sql`select l.id from leads l where ${scopeWhere(list)} order by (exists (select 1 from deals d where d.lead_id = l.id and d.import_pending)) desc, ${list.startsWith("age:") ? sql`l.enriched_at asc` : sql`l.enrich_tried_at nulls first`}, md5(l.id::text) limit 1`);
    if (!next) break;
    tried++;
    // marca antes: se a consulta travar ou cair, este lead não bloqueia a fila
    await db.execute(sql`update leads set enrich_tried_at = now() where id = ${next.id}`);
    try { (await enrichLead(next.id, userId, origin)).state === "ok" ? ok++ : failed++; } catch { failed++; }
    await new Promise((r) => setTimeout(r, 1200));
  }
  const st = await enrichStats();
  return { tried, ok, failed, left: st.lists[list] ?? 0 };
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
