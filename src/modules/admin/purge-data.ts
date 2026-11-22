import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PURGE_CATEGORIES, PURGE_SQL, type PurgeKey } from "./purge-spec";

/** Quantos registros há em cada categoria (e quantos são de teste). Uma consulta só. */
export async function categoryCounts(): Promise<Record<PurgeKey, { total: number; test: number | null; bytes: number }>> {
  const parts = PURGE_CATEGORIES.map((c) => {
    const t = PURGE_SQL[c.key];
    return sql`select ${c.key}::text as k, count(*)::int as total, ${t.test ? sql`(count(*) filter (where ${sql.raw(t.test)}))::int` : sql`null::int`} as test, pg_total_relation_size(${t.table}::regclass)::float8 as bytes from ${sql.raw(t.table)}`;
  });
  const rows = await db.execute<{ k: PurgeKey; total: number; test: number | null; bytes: number }>(sql.join(parts, sql` union all `));
  return Object.fromEntries(rows.map((r) => [r.k, { total: r.total, test: r.test, bytes: Number(r.bytes) }])) as Record<PurgeKey, { total: number; test: number | null; bytes: number }>;
}

export type UserPurgeRow = { id: number; name: string; username: string; roles: string[]; active: boolean; counts: Record<"interactions" | "sessions" | "visits" | "dealsSdr" | "dealsSeller" | "chat" | "audit", number> };

/** Todas as pessoas com o tanto que cada uma produziu. */
export async function userPurgeRows(): Promise<UserPurgeRow[]> {
  const rows = await db.execute<{ id: number; name: string; username: string; roles: string[]; active: boolean; interactions: number; sessions: number; visits: number; deals_sdr: number; deals_seller: number; chat: number; audit: number }>(sql`
    select u.id, u.name, u.username, u.roles, u.active,
      (select count(*)::int from interactions x where x.user_id = u.id) as interactions,
      (select count(*)::int from attendance_sessions x where x.user_id = u.id) as sessions,
      (select count(*)::int from visits x where x.user_id = u.id) as visits,
      (select count(*)::int from deals x where x.sdr_id = u.id) as deals_sdr,
      (select count(*)::int from deals x where x.seller_id = u.id) as deals_seller,
      (select count(*)::int from chat_messages x where x.user_id = u.id) as chat,
      (select count(*)::int from audit_log x where x.user_id = u.id) as audit
    from users u order by u.active desc, lower(u.name)`);
  return rows.map((r) => ({ id: r.id, name: r.name, username: r.username, roles: r.roles, active: r.active, counts: { interactions: r.interactions, sessions: r.sessions, visits: r.visits, dealsSdr: r.deals_sdr, dealsSeller: r.deals_seller, chat: r.chat, audit: r.audit } }));
}

export type LeadHit = { id: number; company: string; cnpj: string; city: string | null; uf: string | null; isTest: boolean; deals: number; visits: number; interactions: number };

/** Procura leads por nome, fantasia, CNPJ (só dígitos) ou cidade. */
export async function searchLeadsForPurge(q: string): Promise<LeadHit[]> {
  const t = q.trim();
  if (!t) return [];
  const like = `%${t.replace(/[%_\\]/g, "")}%`;
  const digits = t.replace(/\D/g, "");
  const rows = await db.execute<{ id: number; company: string; cnpj: string; city: string | null; uf: string | null; is_test: boolean; deals: number; visits: number; interactions: number }>(sql`
    select l.id, l.company, l.cnpj, l.city, l.uf, l.is_test,
      (select count(*)::int from deals d where d.lead_id = l.id) as deals,
      (select count(*)::int from visits v where v.lead_id = l.id) as visits,
      (select count(*)::int from interactions i where i.lead_id = l.id) as interactions
    from leads l
    where l.company ilike ${like} or l.trade_name ilike ${like} or l.city ilike ${like} ${digits.length >= 3 ? sql`or l.cnpj like ${`%${digits}%`}` : sql``}
    order by l.company limit 30`);
  return rows.map((r) => ({ id: r.id, company: r.company, cnpj: r.cnpj, city: r.city, uf: r.uf, isTest: r.is_test, deals: r.deals, visits: r.visits, interactions: r.interactions }));
}

export type LeadRecords = {
  lead: { id: number; company: string; cnpj: string; city: string | null; uf: string | null; isTest: boolean };
  deals: { id: number; stage: string; seller: string | null; sdr: string | null; valueCents: number | null; at: string }[];
  quotes: { id: number; dealId: number; number: string | null; totalCents: number | null; at: string }[];
  visits: { id: number; code: string; date: string | null; status: string; canceled: boolean; by: string | null }[];
  interactions: { id: number; channel: string; note: string | null; by: string | null; at: string }[];
  sessions: { id: number; by: string | null; at: string; outcome: string | null }[];
  tags: { tagId: number; label: string; group: string }[];
  channels: { id: number; kind: string; value: string }[];
  people: { id: number; name: string; role: string | null }[];
};

/** Tudo que está ligado a um lead, registro por registro. */
export async function leadRecords(id: number): Promise<LeadRecords | null> {
  const [l] = await db.execute<{ id: number; company: string; cnpj: string; city: string | null; uf: string | null; is_test: boolean }>(sql`select id, company, cnpj, city, uf, is_test from leads where id = ${id}`);
  if (!l) return null;
  const iso = (v: unknown) => new Date(v as string).toISOString();
  const [deals, quotes, visits, inter, sess, tags, chans, people] = await Promise.all([
    db.execute<{ id: number; stage: string; seller: string | null; sdr: string | null; value: number | null; at: string }>(sql`select d.id, d.stage, s.name as seller, a.name as sdr, coalesce(d.real_value_cents, d.net_value_cents, d.closed_value_cents, d.value_cents) as value, d.created_at as at from deals d left join users s on s.id = d.seller_id left join users a on a.id = d.sdr_id where d.lead_id = ${id} order by d.id desc limit 100`),
    db.execute<{ id: number; deal_id: number; number: string | null; total: number | null; at: string }>(sql`select q.id, q.deal_id, q.number, q.total_cents as total, q.created_at as at from deal_quotes q join deals d on d.id = q.deal_id where d.lead_id = ${id} order by q.id desc limit 100`),
    db.execute<{ id: number; code: string; date: string | null; status: string; canceled: boolean; by: string | null }>(sql`select v.id, v.code, v.visit_date::text as date, v.status, (v.canceled_at is not null) as canceled, u.name as by from visits v left join users u on u.id = v.user_id where v.lead_id = ${id} order by v.id desc limit 100`),
    db.execute<{ id: number; channel: string; note: string | null; by: string | null; at: string }>(sql`select i.id, i.channel, i.note, u.name as by, i.at from interactions i left join users u on u.id = i.user_id where i.lead_id = ${id} order by i.at desc limit 100`),
    db.execute<{ id: number; by: string | null; at: string; outcome: string | null }>(sql`select s.id, u.name as by, s.shown_at as at, s.outcome from attendance_sessions s left join users u on u.id = s.user_id where s.lead_id = ${id} order by s.shown_at desc limit 100`),
    db.execute<{ tag_id: number; label: string; grp: string }>(sql`select lt.tag_id, t.label, g.name as grp from lead_tags lt join tags t on t.id = lt.tag_id join tag_groups g on g.key = t.group_key where lt.lead_id = ${id} order by g.sort, t.sort`),
    db.execute<{ id: number; kind: string; value: string }>(sql`select id, kind, value from lead_channels where lead_id = ${id} order by kind, id`),
    db.execute<{ id: number; name: string; role: string | null }>(sql`select id, name, role_title as role from lead_people where lead_id = ${id} order by id`),
  ]);
  return {
    lead: { id: l.id, company: l.company, cnpj: l.cnpj, city: l.city, uf: l.uf, isTest: l.is_test },
    deals: deals.map((d) => ({ id: d.id, stage: d.stage, seller: d.seller, sdr: d.sdr, valueCents: d.value, at: iso(d.at) })),
    quotes: quotes.map((q) => ({ id: q.id, dealId: q.deal_id, number: q.number, totalCents: q.total, at: iso(q.at) })),
    visits: visits.map((v) => ({ id: v.id, code: v.code, date: v.date, status: v.status, canceled: v.canceled, by: v.by })),
    interactions: inter.map((i) => ({ id: i.id, channel: i.channel, note: i.note, by: i.by, at: iso(i.at) })),
    sessions: sess.map((s) => ({ id: s.id, by: s.by, at: iso(s.at), outcome: s.outcome })),
    tags: tags.map((t) => ({ tagId: t.tag_id, label: t.label, group: t.grp })),
    channels: chans,
    people,
  };
}
