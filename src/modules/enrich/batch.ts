import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSettings } from "@/modules/settings/get";
import { enrichLead } from "./enrich";

/** Lead que ainda não foi consultado e que não falhou nas últimas 6 horas. */
const PENDING = sql`not l.is_test and l.enriched_at is null and (l.enrich_tried_at is null or l.enrich_tried_at < now() - interval '6 hours')`;

export type EnrichStats = { total: number; done: number; pending: number; failed: number };

export async function enrichStats(): Promise<EnrichStats> {
  const [r] = await db.execute<{ total: number; done: number; pending: number; failed: number }>(sql`
    select count(*)::int as total,
      count(*) filter (where l.enriched_at is not null)::int as done,
      count(*) filter (where ${PENDING})::int as pending,
      count(*) filter (where l.enriched_at is null and l.enrich_tried_at is not null and l.enrich_tried_at >= now() - interval '6 hours')::int as failed
    from leads l where not l.is_test`);
  return r ?? { total: 0, done: 0, pending: 0, failed: 0 };
}

/** Consulta até `max` leads, um de cada vez (as APIs gratuitas limitam o ritmo), parando quando passar de `budgetMs`. */
export async function enrichBatch(max: number, budgetMs = 25_000, userId: number | null = null, origin: "lote" | "cron" = "lote"): Promise<{ tried: number; ok: number; failed: number; left: number }> {
  const t0 = Date.now();
  let tried = 0, ok = 0, failed = 0;
  while (tried < max && Date.now() - t0 < budgetMs) {
    const [next] = await db.execute<{ id: number }>(sql`select l.id from leads l where ${PENDING} order by l.enrich_tried_at nulls first, md5(l.id::text) limit 1`);
    if (!next) break;
    tried++;
    // marca antes: se a consulta travar ou cair, este lead não bloqueia a fila
    await db.execute(sql`update leads set enrich_tried_at = now() where id = ${next.id}`);
    try { (await enrichLead(next.id, userId, origin)).state === "ok" ? ok++ : failed++; } catch { failed++; }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { tried, ok, failed, left: (await enrichStats()).pending };
}

export async function autoEnrichOn(): Promise<boolean> {
  return (await getSettings()).auto_enrich === 1;
}
