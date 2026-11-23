import { and, asc, eq, sql } from "drizzle-orm";
import { db, fieldDefs, leadFacts, users } from "@/db";
import type { FactView, FieldDefView, FieldKind, FieldScope } from "@/config/facts";

const toDef = (r: typeof fieldDefs.$inferSelect): FieldDefView => ({ key: r.key, label: r.label, kind: r.kind as FieldKind, options: r.options ?? [], scope: r.scope as FieldScope, groupName: r.groupName, ttlDays: r.ttlDays, priority: r.priority, active: r.active });

/** Campos ativos do catálogo (a tela do Adm usa `all` para ver também os desligados). */
export async function fieldCatalog(all = false): Promise<FieldDefView[]> {
  const rows = await db.select().from(fieldDefs).where(all ? undefined : eq(fieldDefs.active, true)).orderBy(asc(fieldDefs.groupName), sql`${fieldDefs.priority} desc`);
  return rows.map(toDef);
}

/** Respostas atuais de um lead (as antigas ficam no histórico, fora daqui). */
export async function factsOf(leadId: number): Promise<FactView[]> {
  const rows = await db.select({ key: leadFacts.key, value: leadFacts.value, confidence: leadFacts.confidence, createdAt: leadFacts.createdAt, confirmedAt: leadFacts.confirmedAt, personId: leadFacts.personId, by: users.name })
    .from(leadFacts).leftJoin(users, eq(users.id, leadFacts.userId)).where(and(eq(leadFacts.leadId, leadId), eq(leadFacts.current, true)));
  return rows.map((r) => ({ key: r.key, value: r.value, confidence: Math.min(3, Math.max(1, r.confidence)) as 1 | 2 | 3, at: (r.confirmedAt ?? r.createdAt).toISOString(), personId: r.personId, by: r.by }));
}

export type UnitView = { id: number; cnpj: string; company: string; city: string | null; uf: string | null; phones: string[]; people: { id: number; name: string; roleTitle: string | null }[] };

/** Outras unidades da mesma empresa: mesmo CNPJ base (8 primeiros dígitos). Todas podem ser contatadas. */
export async function unitsOf(leadId: number): Promise<UnitView[]> {
  const rows = await db.execute<{ id: number; cnpj: string; company: string; city: string | null; uf: string | null; phones: string[] | null; people: { id: number; name: string; roleTitle: string | null }[] | null }>(sql`
    select l.id, l.cnpj, l.company, l.city, l.uf, l.phones,
      coalesce((select json_agg(json_build_object('id', p.id, 'name', p.name, 'roleTitle', p.role_title) order by p.id) from lead_people p where p.lead_id = l.id and p.status = 'ativo'), '[]'::json) as people
    from leads l
    where substr(l.cnpj, 1, 8) = (select substr(cnpj, 1, 8) from leads where id = ${leadId}) and l.id <> ${leadId} and l.is_test = false
    order by l.cnpj limit 30`);
  return rows.map((r) => ({ id: r.id, cnpj: r.cnpj, company: r.company, city: r.city, uf: r.uf, phones: r.phones ?? [], people: r.people ?? [] }));
}

/** Tudo que o atendimento precisa saber dos dados de um lead, numa só chamada. */
export async function loadKnowledge(leadId: number) {
  const [defs, facts, units] = await Promise.all([fieldCatalog(), factsOf(leadId), unitsOf(leadId)]);
  return { defs, facts, units };
}
export type Knowledge = Awaited<ReturnType<typeof loadKnowledge>>;
