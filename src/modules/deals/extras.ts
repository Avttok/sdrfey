import { and, count, inArray, isNull, sql } from "drizzle-orm";
import { callScripts, dealEvents, dealQuotes, db, leadPeople, visits } from "@/db";
import type { DealRow } from "./queries";

/** O que cada negociação já tem de registro: contatos do vendedor, cotações, roteiros das ligações, pessoas e visitas. */
export type DealExtra = {
  contacts: number; quotes: number; scriptRuns: number; people: number; visits: number;
  /** Com quem o SDR falou na última ligação roteirizada (nome anotado em “Conversando atualmente com”). */
  talkedTo: string | null; lastScriptOutcome: string | null; lastScriptAt: string | null;
  lastEventKind: string | null; lastEventAt: string | null;
};
export type DealWithExtra = DealRow & { x: DealExtra };

const EMPTY: DealExtra = { contacts: 0, quotes: 0, scriptRuns: 0, people: 0, visits: 0, talkedTo: null, lastScriptOutcome: null, lastScriptAt: null, lastEventKind: null, lastEventAt: null };

/** Junta os números por negociação em poucas consultas (uma por tipo de registro), só para quem precisa (lista de negociações). */
export async function withExtras(rows: DealRow[]): Promise<DealWithExtra[]> {
  if (!rows.length) return [];
  const dealIds = rows.map((r) => r.id);
  const leadIds = [...new Set(rows.map((r) => r.leadId))];
  const [ev, qt, sc, pp, vs, lastEv] = await Promise.all([
    db.select({ id: dealEvents.dealId, n: count() }).from(dealEvents).where(and(inArray(dealEvents.dealId, dealIds), inArray(dealEvents.kind, ["ligacao", "whatsapp", "email"]))).groupBy(dealEvents.dealId),
    db.select({ id: dealQuotes.dealId, n: count() }).from(dealQuotes).where(inArray(dealQuotes.dealId, dealIds)).groupBy(dealQuotes.dealId),
    db.execute<{ lead_id: number; n: number; talked: string | null; outcome: string | null; at: Date | null }>(sql`
      select lead_id, count(*)::int as n,
        (array_agg(contact_name order by started_at desc) filter (where contact_name is not null))[1] as talked,
        (array_agg(outcome order by started_at desc))[1] as outcome, max(started_at) as at
      from call_scripts where lead_id in (${sql.join(leadIds.map((i) => sql`${i}`), sql`, `)}) and not is_test group by lead_id`),
    db.select({ id: leadPeople.leadId, n: count() }).from(leadPeople).where(inArray(leadPeople.leadId, leadIds)).groupBy(leadPeople.leadId),
    db.select({ id: visits.leadId, n: count() }).from(visits).where(and(inArray(visits.leadId, leadIds), isNull(visits.canceledAt))).groupBy(visits.leadId),
    db.execute<{ deal_id: number; kind: string; at: Date }>(sql`
      select distinct on (deal_id) deal_id, kind, at from deal_events where deal_id in (${sql.join(dealIds.map((i) => sql`${i}`), sql`, `)}) order by deal_id, at desc, id desc`),
  ]);
  const by = <T extends { id: number; n: number }>(l: T[]) => new Map(l.map((r) => [r.id, Number(r.n)]));
  const E = by(ev), Q = by(qt), P = by(pp), V = by(vs);
  const S = new Map(sc.map((r) => [r.lead_id, r]));
  const L = new Map(lastEv.map((r) => [r.deal_id, r]));
  return rows.map((r) => {
    const s = S.get(r.leadId); const l = L.get(r.id);
    return { ...r, x: { ...EMPTY, contacts: E.get(r.id) ?? 0, quotes: Q.get(r.id) ?? 0, people: P.get(r.leadId) ?? 0, visits: V.get(r.leadId) ?? 0, scriptRuns: s?.n ?? 0, talkedTo: s?.talked ?? null, lastScriptOutcome: s?.outcome ?? null, lastScriptAt: s?.at ? new Date(s.at).toISOString() : null, lastEventKind: l?.kind ?? null, lastEventAt: l?.at ? new Date(l.at).toISOString() : null } };
  });
}
