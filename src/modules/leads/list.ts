import { and, desc, sql, type SQL } from "drizzle-orm";
import { db, leads } from "@/db";
import { dayEnd, dayStart } from "@/lib/format";

export type LeadFilters = {
  q?: string;
  /** "grupo:chave" — dentro do mesmo grupo vale "ou"; entre grupos vale "e". */
  tags: string[];
  owner?: string; // id ou "-" (sem responsável)
  uf?: string;
  city?: string;
  phone?: "1" | "0";
  email?: "1" | "0";
  status?: string; // situação cadastral
  from?: string; // AAAA-MM-DD
  to?: string;
  visit?: string;
  page: number;
};

export const PAGE_SIZE = 50;

export function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() || undefined : undefined);
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : []);
  const flag = (k: string) => (one(k) === "1" ? "1" : one(k) === "0" ? "0" : undefined);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  return {
    q: one("q"), tags: many("tag").filter((t) => /^[\w]+:[\w-]+$/.test(t)), owner: one("owner"), uf: one("uf")?.toUpperCase(), city: one("city"),
    phone: flag("phone"), email: flag("email"), status: one("status"), from: date("from"), to: date("to"), visit: one("visit"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

function where(f: LeadFilters): SQL | undefined {
  const c: SQL[] = [sql`${leads.isTest} = false`];
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    c.push(sql`(${leads.company} ilike ${like} or ${leads.tradeName} ilike ${like} or exists (select 1 from lead_people p where p.lead_id = ${leads.id} and p.name ilike ${like})
      ${digits.length >= 3 ? sql`or ${leads.cnpj} like ${`%${digits}%`} or exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.value like ${`%${digits}%`})` : sql``}
      or exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'email' and c.value ilike ${like}))`);
  }
  const byGroup = new Map<string, string[]>();
  for (const t of f.tags) {
    const [g, k] = t.split(":");
    byGroup.set(g, [...(byGroup.get(g) ?? []), k]);
  }
  for (const [g, keys] of byGroup) {
    c.push(sql`exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = ${leads.id} and t.group_key = ${g} and t.key in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)}))`);
  }
  if (f.owner === "-") c.push(sql`${leads.ownerId} is null`);
  else if (f.owner && /^\d+$/.test(f.owner)) c.push(sql`${leads.ownerId} = ${Number(f.owner)}`);
  if (f.uf) c.push(sql`${leads.uf} = ${f.uf}`);
  if (f.city) c.push(sql`${leads.city} ilike ${`%${f.city}%`}`);
  if (f.status) c.push(sql`${leads.registrationStatus} ilike ${f.status}`);
  if (f.phone) c.push(f.phone === "1" ? sql`exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'phone' and not c.wrong)` : sql`not exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'phone' and not c.wrong)`);
  if (f.email) c.push(f.email === "1" ? sql`exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'email' and not c.wrong)` : sql`not exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'email' and not c.wrong)`);
  if (f.from) c.push(sql`${leads.updatedAt} >= ${dayStart(f.from).toISOString()}::timestamptz`);
  if (f.to) c.push(sql`${leads.updatedAt} <= ${dayEnd(f.to).toISOString()}::timestamptz`);
  if (f.visit) c.push(sql`exists (select 1 from visits v where v.lead_id = ${leads.id} and v.code ilike ${`%${f.visit}%`})`);
  return and(...c);
}

export async function listLeads(f: LeadFilters) {
  const w = where(f);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(w);
  const rows = await db.execute<{ id: number; company: string; trade_name: string | null; cnpj: string; city: string | null; uf: string | null; owner_name: string | null; owner_accent: string | null; owner_id: number | null; locked_by_name: string | null; locked_by_accent: string | null; locked_by_id: number | null; tags: { label: string; color: string; group: string }[] }>(sql`
    select leads.id, leads.company, leads.trade_name, leads.cnpj, leads.city, leads.uf, o.name as owner_name, o.accent as owner_accent, leads.owner_id as owner_id, lk.name as locked_by_name, lk.accent as locked_by_accent, lk.id as locked_by_id,
      coalesce((select json_agg(json_build_object('label', t.label, 'color', t.color, 'group', t.group_key) order by g.sort, t.sort)
                from lead_tags lt join tags t on t.id = lt.tag_id join tag_groups g on g.key = t.group_key where lt.lead_id = leads.id and t.group_key in ('temperatura','meio','qualificacao','agenda','situacao')), '[]'::json) as tags
    from leads left join users o on o.id = leads.owner_id left join users lk on lk.id = leads.locked_by
    where ${w ?? sql`true`}
    order by leads.updated_at desc, leads.id desc
    limit ${PAGE_SIZE} offset ${(f.page - 1) * PAGE_SIZE}`);
  return { total: n, rows: [...rows], pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}
void desc;
