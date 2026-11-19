import { sql } from "drizzle-orm";
import { db } from "@/db";
import { enrichStats, type EnrichStats } from "./batch";

export type LogRow = { id: number; leadId: number; company: string; cnpj: string; at: string; origin: string; ok: boolean; ms: number; by: string | null; status: string | null; phones: number; emails: number; why: string | null };
export type Live = {
  now: string;
  stats: EnrichStats & { ready: number };
  rate: { m10: number; h1: number; h24: number; okPct: number | null; avgMs: number | null; perMin: number; etaMin: number | null };
  running: boolean;
  lastOkAt: string | null;
  queue: { id: number; company: string; cnpj: string; priorTry: string | null }[];
  recent: LogRow[];
  failed: { id: number; company: string; cnpj: string; at: string; why: string | null; tries: number }[];
  hours: { h: string; ok: number; fail: number }[];
  origins: { origin: string; n: number; ok: number }[];
  topWhy: { why: string; n: number }[];
};

const PENDING = sql`not l.is_test and l.enriched_at is null and (l.enrich_tried_at is null or l.enrich_tried_at < now() - interval '6 hours')`;
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

const LOG_SELECT = sql`select g.id, g.lead_id, l.company, l.cnpj, g.at, g.origin, g.ok, g.ms, u.name as by, g.status, g.phones, g.emails, g.why
  from enrich_log g join leads l on l.id = g.lead_id left join users u on u.id = g.user_id`;
const toRow = (r: Record<string, unknown>): LogRow => ({ id: Number(r.id), leadId: Number(r.lead_id), company: String(r.company), cnpj: String(r.cnpj), at: iso(r.at)!, origin: String(r.origin), ok: !!r.ok, ms: Number(r.ms), by: (r.by as string) ?? null, status: (r.status as string) ?? null, phones: Number(r.phones), emails: Number(r.emails), why: (r.why as string) ?? null });

export async function liveData(): Promise<Live> {
  const [stats, [ready], [rt], queue, recent, failed, hours, origins, topWhy, [last]] = await Promise.all([
    enrichStats(),
    db.execute<{ n: number }>(sql`select count(*)::int as n from leads l where not l.is_test and l.enriched_at is not null and not exists (select 1 from interactions i where i.lead_id = l.id)`),
    db.execute<{ m10: number; h1: number; h24: number; ok24: number; avg: number | null; last15: number; ok10: number }>(sql`
      select count(*) filter (where at > now() - interval '10 minutes')::int as m10, count(*) filter (where at > now() - interval '1 hour')::int as h1,
        count(*)::int as h24, count(*) filter (where ok)::int as ok24, avg(ms)::int as avg, count(*) filter (where at > now() - interval '20 seconds')::int as last15,
        count(*) filter (where ok and at > now() - interval '10 minutes')::int as ok10
      from enrich_log where at > now() - interval '24 hours'`),
    db.execute<{ id: number; company: string; cnpj: string; t: Date | null }>(sql`select l.id, l.company, l.cnpj, l.enrich_tried_at as t from leads l where ${PENDING} order by l.enrich_tried_at nulls first, l.id limit 10`),
    db.execute(sql`${LOG_SELECT} order by g.id desc limit 25`),
    db.execute<{ id: number; company: string; cnpj: string; t: Date; why: string | null; tries: number }>(sql`
      select l.id, l.company, l.cnpj, l.enrich_tried_at as t, (select why from enrich_log x where x.lead_id = l.id order by x.id desc limit 1) as why, (select count(*)::int from enrich_log x where x.lead_id = l.id and not x.ok) as tries
      from leads l where not l.is_test and l.enriched_at is null and l.enrich_tried_at >= now() - interval '6 hours' order by l.enrich_tried_at desc limit 15`),
    db.execute<{ h: string; ok: number; fail: number }>(sql`
      select to_char(g.h at time zone 'America/Sao_Paulo', 'HH24"h"') as h, coalesce(c.ok, 0)::int as ok, coalesce(c.fail, 0)::int as fail
      from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') g(h)
      left join (select date_trunc('hour', at) as h, count(*) filter (where ok) as ok, count(*) filter (where not ok) as fail from enrich_log where at > now() - interval '24 hours' group by 1) c on c.h = g.h order by g.h`),
    db.execute<{ origin: string; n: number; ok: number }>(sql`select origin, count(*)::int as n, count(*) filter (where ok)::int as ok from enrich_log where at > now() - interval '24 hours' group by 1 order by 2 desc`),
    db.execute<{ why: string; n: number }>(sql`select left(why, 90) as why, count(*)::int as n from enrich_log where not ok and why is not null and at > now() - interval '24 hours' group by 1 order by 2 desc limit 5`),
    db.execute<{ at: Date | null }>(sql`select max(at) as at from enrich_log where ok`),
  ]);
  const perMin = (rt?.ok10 ?? 0) / 10;
  return {
    now: new Date().toISOString(),
    stats: { ...stats, ready: ready?.n ?? 0 },
    rate: { m10: rt?.m10 ?? 0, h1: rt?.h1 ?? 0, h24: rt?.h24 ?? 0, okPct: rt?.h24 ? Math.round(((rt.ok24 ?? 0) / rt.h24) * 100) : null, avgMs: rt?.avg ?? null, perMin, etaMin: perMin > 0 ? Math.round(stats.pending / perMin) : null },
    running: (rt?.last15 ?? 0) > 0,
    lastOkAt: iso(last?.at),
    queue: queue.map((q) => ({ id: q.id, company: q.company, cnpj: q.cnpj, priorTry: iso(q.t) })),
    recent: recent.map(toRow),
    failed: failed.map((f) => ({ id: f.id, company: f.company, cnpj: f.cnpj, at: iso(f.t)!, why: f.why, tries: f.tries })),
    hours: [...hours],
    origins: [...origins],
    topWhy: [...topWhy],
  };
}

/** Histórico completo, com filtro e paginação. */
export async function logPage(opts: { page: number; result: "all" | "ok" | "fail"; origin: string; q: string }): Promise<{ rows: LogRow[]; total: number; pages: number }> {
  const PAGE = 25;
  const where = sql`where true ${opts.result === "ok" ? sql`and g.ok` : opts.result === "fail" ? sql`and not g.ok` : sql``} ${opts.origin ? sql`and g.origin = ${opts.origin}` : sql``} ${opts.q ? sql`and (l.company ilike ${"%" + opts.q + "%"} or l.cnpj like ${"%" + opts.q.replace(/\D/g, "") + "%"})` : sql``}`;
  const [t] = await db.execute<{ n: number }>(sql`select count(*)::int as n from enrich_log g join leads l on l.id = g.lead_id ${where}`);
  const total = t?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(pages, Math.max(1, opts.page));
  const rows = await db.execute(sql`${LOG_SELECT} ${where} order by g.id desc limit ${PAGE} offset ${(page - 1) * PAGE}`);
  return { rows: rows.map(toRow), total, pages };
}
