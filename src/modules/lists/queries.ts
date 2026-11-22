import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db, leadLists, users } from "@/db";
import { cleanListFilters, LIST_MAX_LEADS, type ListFilters } from "@/config/lists";
import { listCondition } from "./where";

export type ListKind = "sdr" | "vendas";
export type ListRow = { id: number; name: string; kind: ListKind; filters: ListFilters; active: boolean; /** leads reservados na lista */ total: number; /** quantos ainda podem ser sorteados */ count: number; shared: boolean };
export type SharedRow = { id: number; name: string; owner: string; total: number; count: number; sharedAt: string };

/** Regra de quem pode ser sorteado (simplificada) para um lead `l`. */
const eligible = (kind: ListKind, userId: number) => sql`not l.is_test and l.locked_by is null and l.kind = ${kind === "sdr" ? "prospect" : "inativo"}
  ${kind === "sdr" ? sql`and (l.owner_id is null or l.owner_id = ${userId}) and not exists (select 1 from deals dd where dd.lead_id = l.id)` : sql`and not exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))`}
  and not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.blocks_sorting)`;
/** Leads livres para uma lista nova: fora de qualquer outra lista (os da própria lista em edição contam como livres). */
const free = (ownList?: number) => sql`not exists (select 1 from lead_list_items i where i.lead_id = l.id and i.list_id is distinct from ${ownList ?? null}::int)`;

/** Leads disponíveis para montar uma lista com estes filtros. */
export async function countList(kind: ListKind, f: ListFilters, userId: number, ownList?: number): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from leads l where ${eligible(kind, userId)} and ${free(ownList)} and ${listCondition(f)}`);
  return r?.n ?? 0;
}

export async function sampleList(kind: ListKind, f: ListFilters, userId: number, ownList?: number) {
  return db.execute<{ id: number; company: string; trade_name: string | null; city: string | null; uf: string | null; phones: number }>(sql`
    select l.id, l.company, l.trade_name, l.city, l.uf, (select count(*)::int from lead_channels ch where ch.lead_id = l.id and ch.kind = 'phone' and not ch.wrong) as phones
    from leads l where ${eligible(kind, userId)} and ${free(ownList)} and ${listCondition(f)}
    order by random() limit 6`);
}

/** Reserva até 100 leads para a lista (aleatórios entre os que combinam). Devolve quantos entraram. */
export async function fillList(tx: Pick<typeof db, "execute">, kind: ListKind, f: ListFilters, userId: number, listId: number): Promise<number> {
  const rows = await tx.execute<{ lead_id: number }>(sql`
    insert into lead_list_items (lead_id, list_id)
    select l.id, ${listId} from leads l where ${eligible(kind, userId)} and ${free(listId)} and ${listCondition(f)}
    order by l.id limit ${LIST_MAX_LEADS}
    on conflict (lead_id) do nothing returning lead_id`);
  return rows.length;
}

/** Leads da lista que ainda podem ser sorteados e o total reservado. */
async function sizes(kind: ListKind, listId: number, userId: number): Promise<{ total: number; count: number }> {
  const [r] = await db.execute<{ total: number; n: number }>(sql`
    select (select count(*)::int from lead_list_items where list_id = ${listId}) as total,
           (select count(*)::int from leads l join lead_list_items i on i.lead_id = l.id where i.list_id = ${listId} and ${eligible(kind, userId)}) as n`);
  return { total: r?.total ?? 0, count: r?.n ?? 0 };
}

/** Quantas listas ocupam espaço da pessoa (Prospecção + Vendas): as que têm leads reservados. Lista zerada não ocupa. */
export async function listsUsed(userId: number): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from lead_lists ll where ll.owner_id = ${userId} and exists (select 1 from lead_list_items i where i.list_id = ll.id)`);
  return r?.n ?? 0;
}

export async function myLists(userId: number, kind: ListKind): Promise<ListRow[]> {
  const rows = await db.select().from(leadLists).where(and(eq(leadLists.ownerId, userId), eq(leadLists.kind, kind))).orderBy(desc(leadLists.active), desc(leadLists.id));
  return Promise.all(rows.map(async (r) => ({ id: r.id, name: r.name, kind, filters: cleanListFilters(r.filters), active: r.active, shared: r.sharedAt != null, ...(await sizes(kind, r.id, userId)) })));
}

/** Listas que outras pessoas deixaram para resgatar (da mesma área). */
export async function sharedLists(userId: number, kind: ListKind): Promise<SharedRow[]> {
  const rows = await db.select({ id: leadLists.id, name: leadLists.name, at: leadLists.sharedAt, owner: users.name }).from(leadLists).innerJoin(users, eq(users.id, leadLists.ownerId))
    .where(and(eq(leadLists.kind, kind), isNotNull(leadLists.sharedAt), ne(leadLists.ownerId, userId))).orderBy(desc(leadLists.sharedAt));
  return Promise.all(rows.map(async (r) => ({ id: r.id, name: r.name, owner: r.owner, sharedAt: r.at!.toISOString(), ...(await sizes(kind, r.id, userId)) })));
}

/** Lista ativa da pessoa (e quantos leads ainda sobram), ou null. */
export async function activeList(userId: number, kind: ListKind): Promise<{ id: number; name: string; count: number } | null> {
  const [r] = await db.select().from(leadLists).where(and(eq(leadLists.ownerId, userId), eq(leadLists.kind, kind), eq(leadLists.active, true))).limit(1);
  if (!r) return null;
  return { id: r.id, name: r.name, count: (await sizes(kind, r.id, userId)).count };
}
