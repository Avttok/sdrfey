import { and, desc, eq, sql } from "drizzle-orm";
import { db, leadLists } from "@/db";
import { cleanListFilters, type ListFilters } from "@/config/lists";
import { listCondition } from "./where";

export type ListKind = "sdr" | "vendas";
export type ListRow = { id: number; name: string; kind: ListKind; filters: ListFilters; active: boolean; count: number };

/** Leads da lista que ainda podem ser sorteados (regra simplificada do sorteio: tipo certo, sem bloqueio, sem negociação aberta). */
export async function countList(kind: ListKind, f: ListFilters, userId: number): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from leads l
    where not l.is_test and l.locked_by is null and l.kind = ${kind === "sdr" ? "prospect" : "inativo"}
      ${kind === "sdr" ? sql`and (l.owner_id is null or l.owner_id = ${userId}) and not exists (select 1 from deals dd where dd.lead_id = l.id)` : sql`and not exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))`}
      and not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.blocks_sorting)
      and ${listCondition(f)}`);
  return r?.n ?? 0;
}

export async function sampleList(kind: ListKind, f: ListFilters, userId: number) {
  return db.execute<{ id: number; company: string; trade_name: string | null; city: string | null; uf: string | null; phones: number }>(sql`
    select l.id, l.company, l.trade_name, l.city, l.uf, (select count(*)::int from lead_channels ch where ch.lead_id = l.id and ch.kind = 'phone' and not ch.wrong) as phones
    from leads l
    where not l.is_test and l.locked_by is null and l.kind = ${kind === "sdr" ? "prospect" : "inativo"}
      ${kind === "sdr" ? sql`and (l.owner_id is null or l.owner_id = ${userId}) and not exists (select 1 from deals dd where dd.lead_id = l.id)` : sql`and not exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))`}
      and not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.blocks_sorting)
      and ${listCondition(f)}
    order by random() limit 6`);
}

export async function myLists(userId: number, kind: ListKind): Promise<ListRow[]> {
  const rows = await db.select().from(leadLists).where(and(eq(leadLists.ownerId, userId), eq(leadLists.kind, kind))).orderBy(desc(leadLists.active), desc(leadLists.id));
  return Promise.all(rows.map(async (r) => { const filters = cleanListFilters(r.filters); return { id: r.id, name: r.name, kind, filters, active: r.active, count: await countList(kind, filters, userId) }; }));
}

/** Lista ativa da pessoa (filtros e quantos leads ainda sobram), ou null. */
export async function activeList(userId: number, kind: ListKind): Promise<{ id: number; name: string; filters: ListFilters; count: number } | null> {
  const [r] = await db.select().from(leadLists).where(and(eq(leadLists.ownerId, userId), eq(leadLists.kind, kind), eq(leadLists.active, true))).limit(1);
  if (!r) return null;
  const filters = cleanListFilters(r.filters);
  return { id: r.id, name: r.name, filters, count: await countList(kind, filters, userId) };
}
