import { sql } from "drizzle-orm";
import { db } from "@/db";
import { EOX_LISTS, normEoxList } from "@/config/eox-lists";
import { eoxConsultLead, loadConsultOptions } from "./consult";

/** Horas até um lead que falhou voltar para a fila (opção do Adm). */
let retryH = 6;
const hours = () => sql`make_interval(hours => ${retryH})`;
/** Quem pode ser procurado na EOX: tem CNPJ de 14 dígitos ou o ID EOX. */
const HAS_KEY = sql`(l.cnpj ~ '^[0-9]{14}$' or l.eox_code is not null)`;
const TRIED_OK = () => sql`(l.eox_tried_at is null or l.eox_tried_at < now() - ${hours()})`;
/** Listas além da fila normal só pegam quem não foi consultado na última semana (senão o mesmo lead voltava sem parar). */
const STALE = sql`(l.eox_checked_at is null or l.eox_checked_at < now() - interval '7 days')`;
const phoneOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong)`;
const emailOk = sql`exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'email' and not c.wrong)`;
const blank = (col: string) => sql.raw(`coalesce(btrim(l.${col}), '') = ''`);

const listCond = (key: string) => {
  if (key.startsWith("uf:")) return sql`l.eox_checked_at is null and l.uf = ${key.slice(3)}`;
  if (key.startsWith("age:")) return sql`l.eox_checked_at is not null and l.eox_checked_at < now() - make_interval(days => ${Number(key.slice(4))})`;
  switch (key) {
    case "fresh": return sql`l.eox_checked_at is null and l.created_at > now() - interval '7 days'`;
    case "unworked": return sql`l.eox_checked_at is null and not exists (select 1 from interactions i where i.lead_id = l.id)`;
    case "deal_open": return sql`${STALE} and exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))`;
    case "qualified": return sql`${STALE} and exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.key = 'qualificado')`;
    case "customers": return sql`${STALE} and exists (select 1 from deals d where d.lead_id = l.id and d.stage = 'ganho')`;
    case "no_link": return sql`${STALE} and (l.eox_id is null or l.eox_id !~ '^[0-9]{7,}$' or l.eox_id = l.eox_code)`;
    case "no_phone": return sql`${STALE} and not ${phoneOk}`;
    case "no_mobile": return sql`${STALE} and not exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong and length(regexp_replace(c.value, '[^0-9]', '', 'g')) >= 11)`;
    case "one_phone": return sql`${STALE} and (select count(*) from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and not c.wrong) = 1`;
    case "no_email": return sql`${STALE} and not ${emailOk}`;
    case "no_person": return sql`${STALE} and not exists (select 1 from lead_people p where p.lead_id = l.id)`;
    case "no_address": return sql`${STALE} and (${blank("address")} or ${blank("zip")})`;
    case "no_web": return sql`${STALE} and ${blank("site")} and ${blank("facebook")} and ${blank("linkedin")}`;
    case "no_ie": return sql`${STALE} and ${blank("state_reg")}`;
    case "eox_blocked": return sql`${STALE} and l.eox_info ->> 'Discagens bloqueadas' = 'Sim'`;
    case "eox_customers": return sql`${STALE} and l.eox_info ->> 'Tipo' in ('Customer', 'Cliente')`;
    default: return sql`true`;
  }
};
const scopeWhere = (key: string) => {
  if (key === "new") return sql`not l.is_test and ${HAS_KEY} and l.eox_checked_at is null and ${TRIED_OK()}`;
  if (key === "retry_failed") return sql`not l.is_test and ${HAS_KEY} and l.eox_checked_at is null and l.eox_tried_at is not null and (l.eox_tried_at < now() - ${hours()} or l.eox_tried_at > now())`;
  return sql`not l.is_test and ${HAS_KEY} and ${TRIED_OK()} and ${listCond(key)}`;
};

export type EoxStats = { total: number; done: number; pending: number; failed: number; /** leads com o Código/link do perfil EOX */ linked: number; lists: Record<string, number>; ufs: Record<string, number> };
export async function eoxStats(): Promise<EoxStats> {
  retryH = (await loadConsultOptions()).retryHours;
  const [r] = await db.execute<Record<string, number>>(sql`
    select count(*)::int as total, count(*) filter (where l.eox_checked_at is not null)::int as done,
      count(*) filter (where l.eox_id ~ '^[0-9]{7,}$' and l.eox_id <> coalesce(l.eox_code, ''))::int as linked,
      count(*) filter (where ${scopeWhere("new")})::int as pending,
      count(*) filter (where l.eox_checked_at is null and l.eox_tried_at is not null and l.eox_tried_at >= now() - ${hours()} and l.eox_tried_at <= now())::int as failed,
      ${sql.join(EOX_LISTS.map((x, i) => sql`count(*) filter (where ${scopeWhere(x.key)})::int as ${sql.raw("l" + i)}`), sql`, `)}
    from leads l where not l.is_test`);
  const ufRows = await db.execute<{ uf: string; n: number }>(sql`select l.uf, count(*)::int as n from leads l where ${scopeWhere("new")} and l.uf ~ '^[A-Z]{2}$' group by 1 order by 2 desc`);
  return { total: r?.total ?? 0, done: r?.done ?? 0, linked: r?.linked ?? 0, pending: r?.pending ?? 0, failed: r?.failed ?? 0, lists: Object.fromEntries(EOX_LISTS.map((x, i) => [x.key, Number(r?.[`l${i}`] ?? 0)])), ufs: Object.fromEntries([...ufRows].map((u) => [u.uf, u.n])) };
}

/** Consulta um bloco de leads, vários ao mesmo tempo, parando quando passar de `budgetMs`. */
export async function eoxBatch(maxIn: number | null, budgetMs = 40_000, userId: number | null = null, listIn: string = "new"): Promise<{ tried: number; ok: number; failed: number }> {
  const o = await loadConsultOptions();
  retryH = o.retryHours;
  const max = maxIn ?? o.batch;
  const t0 = Date.now(), stop = t0 + budgetMs, list = normEoxList(listIn);
  const rows = await db.execute<{ id: number }>(sql`select l.id from leads l where ${scopeWhere(list)} order by (exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))) desc, l.id limit ${max}`);
  const ids = [...rows].map((r) => r.id);
  if (!ids.length) return { tried: 0, ok: 0, failed: 0 };
  await db.execute(sql`update leads set eox_tried_at = now() where id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  let cursor = 0, ok = 0, failed = 0;
  const worker = async () => {
    while (cursor < ids.length && Date.now() < stop) {
      const id = ids[cursor++];
      try { (await eoxConsultLead(id, userId, "lote", o)).ok ? ok++ : failed++; } catch { failed++; }
    }
  };
  await Promise.all(Array.from({ length: o.workers }, worker));
  // o que foi sorteado e não deu tempo de consultar volta para a fila agora
  if (cursor < ids.length) await db.execute(sql`update leads set eox_tried_at = null where id in (${sql.join(ids.slice(cursor).map((i) => sql`${i}`), sql`, `)}) and eox_checked_at is null`);
  return { tried: cursor, ok, failed };
}
