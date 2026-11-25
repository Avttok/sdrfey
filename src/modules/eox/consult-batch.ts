import { sql } from "drizzle-orm";
import { db } from "@/db";
import { EOX_LISTS, normEoxList } from "@/config/eox-lists";
import { eoxConsultLead } from "./consult";

/** Quem pode ser procurado na EOX: tem CNPJ de 14 dígitos ou o ID EOX. */
const HAS_KEY = sql`(l.cnpj ~ '^[0-9]{14}$' or l.eox_code is not null)`;
const TRIED_OK = sql`(l.eox_tried_at is null or l.eox_tried_at < now() - interval '6 hours')`;
/** Listas além da fila normal só pegam quem não foi consultado na última semana (senão o mesmo lead voltava sem parar). */
const STALE = sql`(l.eox_checked_at is null or l.eox_checked_at < now() - interval '7 days')`;
const phoneOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong)`;
const emailOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'email' and not c.wrong)`;
const blank = (col: string) => sql.raw(`coalesce(btrim(l.${col}), '') = ''`);

const listCond = (key: string) => {
  if (key.startsWith("age:")) return sql`l.eox_checked_at is not null and l.eox_checked_at < now() - make_interval(days => ${Number(key.slice(4))})`;
  switch (key) {
    case "deal_open": return sql`${STALE} and exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))`;
    case "qualified": return sql`${STALE} and exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.key = 'qualificado')`;
    case "no_phone": return sql`${STALE} and not ${phoneOk}`;
    case "no_email": return sql`${STALE} and not ${emailOk}`;
    case "no_person": return sql`${STALE} and not exists (select 1 from lead_people p where p.lead_id = l.id)`;
    case "no_address": return sql`${STALE} and (${blank("address")} or ${blank("zip")})`;
    case "customers": return sql`${STALE} and exists (select 1 from deals d where d.lead_id = l.id and d.stage = 'ganho')`;
    default: return sql`true`;
  }
};
const scopeWhere = (key: string) => {
  if (key === "new") return sql`not l.is_test and ${HAS_KEY} and l.eox_checked_at is null and ${TRIED_OK}`;
  if (key === "retry_failed") return sql`not l.is_test and ${HAS_KEY} and l.eox_checked_at is null and l.eox_tried_at is not null and (l.eox_tried_at < now() - interval '6 hours' or l.eox_tried_at > now())`;
  return sql`not l.is_test and ${HAS_KEY} and ${TRIED_OK} and ${listCond(key)}`;
};

export type EoxStats = { total: number; done: number; pending: number; failed: number; lists: Record<string, number> };
export async function eoxStats(): Promise<EoxStats> {
  const [r] = await db.execute<Record<string, number>>(sql`
    select count(*)::int as total, count(*) filter (where l.eox_checked_at is not null)::int as done,
      count(*) filter (where ${scopeWhere("new")})::int as pending,
      count(*) filter (where l.eox_checked_at is null and l.eox_tried_at is not null and l.eox_tried_at >= now() - interval '6 hours' and l.eox_tried_at <= now())::int as failed,
      ${sql.join(EOX_LISTS.map((x, i) => sql`count(*) filter (where ${scopeWhere(x.key)})::int as ${sql.raw("l" + i)}`), sql`, `)}
    from leads l where not l.is_test`);
  return { total: r?.total ?? 0, done: r?.done ?? 0, pending: r?.pending ?? 0, failed: r?.failed ?? 0, lists: Object.fromEntries(EOX_LISTS.map((x, i) => [x.key, Number(r?.[`l${i}`] ?? 0)])) };
}

/** Consulta um bloco de leads, vários ao mesmo tempo, parando quando passar de `budgetMs`. */
export async function eoxBatch(max: number, budgetMs = 40_000, userId: number | null = null, listIn: string = "new"): Promise<{ tried: number; ok: number; failed: number }> {
  const t0 = Date.now(), stop = t0 + budgetMs, list = normEoxList(listIn);
  const rows = await db.execute<{ id: number }>(sql`select l.id from leads l where ${scopeWhere(list)} order by (exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))) desc, l.id limit ${max}`);
  const ids = [...rows].map((r) => r.id);
  if (!ids.length) return { tried: 0, ok: 0, failed: 0 };
  await db.execute(sql`update leads set eox_tried_at = now() where id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  let cursor = 0, ok = 0, failed = 0;
  const worker = async () => {
    while (cursor < ids.length && Date.now() < stop) {
      const id = ids[cursor++];
      try { (await eoxConsultLead(id, userId, "lote")).ok ? ok++ : failed++; } catch { failed++; }
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  // o que foi sorteado e não deu tempo de consultar volta para a fila agora
  if (cursor < ids.length) await db.execute(sql`update leads set eox_tried_at = null where id in (${sql.join(ids.slice(cursor).map((i) => sql`${i}`), sql`, `)}) and eox_checked_at is null`);
  return { tried: cursor, ok, failed };
}
