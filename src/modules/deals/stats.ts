import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayEnd, dayStart } from "@/lib/format";
import { listDeals } from "./queries";
import { closedDay, soldCents } from "./goals";
import type { Period } from "@/modules/dashboard/stats";

const ids = (list: number[]) => sql.join(list.map((i) => sql`${i}`), sql`, `);

/** Números de vendas de um grupo de vendedores num período. */
export async function getSalesStats(period: Period, sellerIds: number[]) {
  const U = ids(sellerIds.length ? sellerIds : [-1]);
  const from = sql`${dayStart(period.from).toISOString()}::timestamptz`;
  const to = sql`${dayEnd(period.to).toISOString()}::timestamptz`;
  const [open, quotes, won, lost, contacts, quotesSent, received, firstContact, ranking, recent] = await Promise.all([
    db.execute<{ n: number }>(sql`select count(*)::int as n from deals where seller_id in (${U}) and stage not in ('ganho','perdido') and not is_test`),
    db.execute<{ n: number; v: number }>(sql`select count(*)::int as n, coalesce(sum(value_cents),0)::bigint as v from deals where seller_id in (${U}) and stage = 'cotacao' and not is_test`),
    db.execute<{ n: number; v: number }>(sql`select count(*)::int as n, coalesce(sum(${soldCents}),0)::bigint as v from deals d where d.seller_id in (${U}) and d.stage = 'ganho' and not d.is_test and ${closedDay} between ${period.from}::date and ${period.to}::date`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from deals where seller_id in (${U}) and stage = 'perdido' and not is_test and closed_at between ${from} and ${to}`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from deal_events e join deals d on d.id = e.deal_id where not d.is_test and d.seller_id in (${U}) and e.kind in ('ligacao','whatsapp','email') and e.at between ${from} and ${to}`),
    db.execute<{ n: number; v: number }>(sql`select count(*)::int as n, coalesce(sum(e.value_cents),0)::bigint as v from deal_events e join deals d on d.id = e.deal_id where not d.is_test and d.seller_id in (${U}) and e.kind = 'cotacao' and e.at between ${from} and ${to}`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from deals where seller_id in (${U}) and not is_test and claimed_at between ${from} and ${to}`),
    db.execute<{ minutes: number | null }>(sql`select avg(extract(epoch from (fc.at - d.claimed_at)) / 60)::float as minutes from deals d
      join lateral (select min(e.at) as at from deal_events e where e.deal_id = d.id and e.kind in ('ligacao','whatsapp','email') and e.at >= d.claimed_at) fc on fc.at is not null
      where d.seller_id in (${U}) and not d.is_test and d.claimed_at between ${from} and ${to}`),
    db.execute<{ id: number; name: string; accent: string | null; roles: string[]; won: number; value: number; contacts: number; open: number; quotes: number; quotesValue: number }>(sql`
      select u.id, u.name, u.accent, u.roles,
        (select count(*)::int from deals d where d.seller_id = u.id and d.stage = 'ganho' and not d.is_test and ${closedDay} between ${period.from}::date and ${period.to}::date) as won,
        (select coalesce(sum(${soldCents}),0)::bigint from deals d where d.seller_id = u.id and d.stage = 'ganho' and not d.is_test and ${closedDay} between ${period.from}::date and ${period.to}::date) as value,
        (select count(*)::int from deal_events e join deals d on d.id = e.deal_id where not d.is_test and d.seller_id = u.id and e.kind in ('ligacao','whatsapp','email') and e.at between ${from} and ${to}) as contacts,
        (select count(*)::int from deals d where d.seller_id = u.id and d.stage not in ('ganho','perdido') and not d.is_test) as open,
        (select count(*)::int from deal_events e join deals d on d.id = e.deal_id where not d.is_test and d.seller_id = u.id and e.kind = 'cotacao' and e.at between ${from} and ${to}) as quotes,
        (select coalesce(sum(e.value_cents),0)::bigint from deal_events e join deals d on d.id = e.deal_id where not d.is_test and d.seller_id = u.id and e.kind = 'cotacao' and e.at between ${from} and ${to}) as "quotesValue"
      from users u where u.id in (${U}) order by won desc, value desc, quotes desc, u.name`),
    db.execute<{ id: number; company: string; value: number | null; at: Date; name: string | null }>(sql`
      select d.id, l.company, ${soldCents} as value, d.closed_at as at, u.name from deals d join leads l on l.id = d.lead_id left join users u on u.id = d.seller_id
      where d.seller_id in (${U}) and d.stage = 'ganho' and not d.is_test and ${closedDay} between ${period.from}::date and ${period.to}::date order by d.closed_at desc limit 6`),
  ]);
  const [stages, daily, vis, upcoming, cycle, lostV, shuf] = await Promise.all([
    db.execute<{ stage: string; n: number; v: number }>(sql`select stage, count(*)::int as n, coalesce(sum(value_cents),0)::bigint as v from deals where seller_id in (${U}) and stage not in ('ganho','perdido') and not is_test group by 1`),
    db.execute<{ d: string; n: number; v: number }>(sql`select ${closedDay}::text as d, count(*)::int as n, coalesce(sum(${soldCents}),0)::bigint as v from deals d where d.seller_id in (${U}) and d.stage = 'ganho' and not d.is_test and ${closedDay} between ${period.from}::date and ${period.to}::date group by 1 order by 1`),
    db.execute<{ status: string; n: number }>(sql`select v.status, count(*)::int as n from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.seller_id in (${U}) and v.created_at between ${from} and ${to} group by 1`),
    db.execute<{ id: number; lead_id: number; company: string; visit_date: string; status: string }>(sql`select v.id, v.lead_id, l.company, v.visit_date::text as visit_date, v.status from visits v join leads l on l.id = v.lead_id where not l.is_test and v.canceled_at is null and v.status <> 'realizada' and v.seller_id in (${U}) and v.visit_date >= current_date order by v.visit_date limit 5`),
    db.execute<{ days: number | null }>(sql`select avg(extract(epoch from (d.closed_at - coalesce(d.claimed_at, d.created_at))) / 86400)::float as days from deals d where d.seller_id in (${U}) and d.stage = 'ganho' and not d.is_test and d.closed_at between ${from} and ${to}`),
    db.execute<{ v: number }>(sql`select coalesce(sum(value_cents),0)::bigint as v from deals where seller_id in (${U}) and stage = 'perdido' and not is_test and closed_at between ${from} and ${to}`),
    db.execute<{ outcome: string; n: number }>(sql`select coalesce(outcome,'aberto') as outcome, count(*)::int as n from seller_shuffles where user_id in (${U}) and not is_test and shown_at between ${from} and ${to} group by 1`),
  ]);
  const vN = (k: string) => vis.find((x) => x.status === k)?.n ?? 0;
  const shN = (k: string) => shuf.find((x) => x.outcome === k)?.n ?? 0;
  const all = await listDeals(0, true);
  const mine = all.filter((d) => d.sellerId && sellerIds.includes(d.sellerId) && d.alerts.length);
  const wonN = won[0]?.n ?? 0, lostN = lost[0]?.n ?? 0;
  return {
    open: open[0]?.n ?? 0, quotesOpen: quotes[0]?.n ?? 0, quotesOpenValue: Number(quotes[0]?.v ?? 0),
    won: wonN, wonValue: Number(won[0]?.v ?? 0), lost: lostN,
    conversion: wonN + lostN ? wonN / (wonN + lostN) : null, ticket: wonN ? Number(won[0]?.v ?? 0) / wonN : null,
    contacts: contacts[0]?.n ?? 0, quotesSent: quotesSent[0]?.n ?? 0, quotesSentValue: Number(quotesSent[0]?.v ?? 0), received: received[0]?.n ?? 0,
    firstContactMinutes: firstContact[0]?.minutes ?? null,
    ranking: [...ranking].map((r) => ({ ...r, value: Number(r.value), quotesValue: Number(r.quotesValue) })),
    recent: recent.map((r) => ({ id: r.id, company: r.company, value: r.value, at: r.at.toString(), name: r.name })),
    stages: stages.map((r) => ({ stage: r.stage, n: r.n, v: Number(r.v) })),
    daily: daily.map((r) => ({ d: r.d, n: r.n, v: Number(r.v) })),
    visits: { pending: vN("pendente"), confirmed: vN("confirmada"), done: vN("realizada") },
    upcoming: upcoming.map((r) => ({ id: r.id, leadId: r.lead_id, company: r.company, date: r.visit_date, status: r.status })),
    cycleDays: cycle[0]?.days ?? null, lostValue: Number(lostV[0]?.v ?? 0),
    shuffler: { worked: shuf.reduce((a, r) => a + r.n, 0), saved: shN("saved"), visit: shN("visit"), deal: shN("deal"), toSdr: shN("to_sdr"), noInterest: shN("no_interest"), noAnswer: shN("no_answer"), skipped: shN("skipped") },
    alerts: mine.map((d) => ({ id: d.id, company: d.company, text: d.alerts[0].text, tone: d.alerts[0].tone })),
  };
}
export type SalesStats = Awaited<ReturnType<typeof getSalesStats>>;
