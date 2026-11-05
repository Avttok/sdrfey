import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayEnd, dayStart } from "@/lib/format";

export type HistFilters = { q?: string; from?: string; to?: string; qual?: "qualificado" | "desqualificado" | "sem"; visit?: "1" };
export type HistRow = {
  session_id: number; lead_id: number; company: string; trade_name: string | null; cnpj: string; city: string | null; uf: string | null;
  saved_at: string; seconds: number | null; notes: string | null; visits: string | null;
  tags: { label: string; color: string; group: string; key: string }[];
};

export function parseHistFilters(sp: Record<string, string | string[] | undefined>): HistFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() || undefined : undefined);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const qual = one("qual");
  return { q: one("q"), from: date("from"), to: date("to"), qual: qual === "qualificado" || qual === "desqualificado" || qual === "sem" ? qual : undefined, visit: one("visit") === "1" ? "1" : undefined };
}

/** Atendimentos salvos de uma pessoa, com tags, visitas e observação. Até 600 linhas. */
export async function userHistoryRich(userId: number, f: HistFilters): Promise<HistRow[]> {
  const c = [sql`s.user_id = ${userId}`, sql`s.saved_at is not null`, sql`not s.is_test`];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    const digits = f.q.replace(/\D/g, "");
    c.push(sql`(l.company ilike ${like} or l.trade_name ilike ${like} or l.city ilike ${like} or l.notes ilike ${like}${digits.length >= 3 ? sql` or l.cnpj like ${`%${digits}%`}` : sql``})`);
  }
  if (f.from) c.push(sql`s.saved_at >= ${dayStart(f.from).toISOString()}::timestamptz`);
  if (f.to) c.push(sql`s.saved_at <= ${dayEnd(f.to).toISOString()}::timestamptz`);
  if (f.qual === "sem") c.push(sql`not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = 'qualificacao')`);
  else if (f.qual) c.push(sql`exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = 'qualificacao' and t.key = ${f.qual})`);
  if (f.visit) c.push(sql`exists (select 1 from visits v where v.lead_id = l.id and v.user_id = s.user_id and v.canceled_at is null)`);
  const rows = await db.execute<HistRow>(sql`
    select s.id as session_id, l.id as lead_id, l.company, l.trade_name, l.cnpj, l.city, l.uf, s.saved_at, l.notes,
      extract(epoch from (s.saved_at - s.started_at))::int as seconds,
      (select string_agg(v.code, ', ' order by v.created_at) from visits v where v.lead_id = l.id and v.user_id = s.user_id and v.canceled_at is null) as visits,
      coalesce((select json_agg(json_build_object('label', t.label, 'color', t.color, 'group', t.group_key, 'key', t.key) order by g.sort, t.sort, t.label)
        from lead_tags lt join tags t on t.id = lt.tag_id join tag_groups g on g.key = t.group_key where lt.lead_id = l.id and t.active), '[]'::json) as tags
    from attendance_sessions s join leads l on l.id = s.lead_id
    where ${sql.join(c, sql` and `)}
    order by s.saved_at desc
    limit 600`);
  return [...rows];
}
