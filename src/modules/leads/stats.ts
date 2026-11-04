import { sql } from "drizzle-orm";
import { db } from "@/db";

export type LeadStats = { total: number; blocked: number; fresh: number; worked: number };

/** Números gerais da base (usados no painel). */
export async function getLeadStats(): Promise<LeadStats> {
  const rows = await db.execute<LeadStats>(sql`
    with blocked as (
      select distinct lt.lead_id
      from lead_tags lt join tags t on t.id = lt.tag_id
      where t.blocks_sorting
    )
    select
      count(*)::int                                                           as total,
      (count(*) filter (where b.lead_id is not null))::int                     as blocked,
      (count(*) filter (where b.lead_id is null and l.times_worked = 0))::int  as fresh,
      (count(*) filter (where l.times_worked > 0))::int                        as worked
    from leads l left join blocked b on b.lead_id = l.id
  `);
  return rows[0] ?? { total: 0, blocked: 0, fresh: 0, worked: 0 };
}
