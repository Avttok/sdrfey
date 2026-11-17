import { sql } from "drizzle-orm";
import { db, settings } from "@/db";
import { eq } from "drizzle-orm";
import { resolveSellerGoals, SALE_BONUS_REAIS, type SellerActuals, type SellerGoalSettings } from "@/config/seller-goals";

const SP = "America/Sao_Paulo";
/** Data (dia) em que a venda foi fechada: a informada pelo vendedor ou a do fechamento. */
export const closedDay = sql`coalesce(d.closed_on, (d.closed_at at time zone ${SP})::date)`;
/** Valor da venda que conta na meta: valor real informado; sem ele, o da última cotação sem impostos (total − IPI − ICMS); depois o fechado e o total. */
export const soldCents = sql`coalesce(d.real_value_cents, d.net_value_cents, d.closed_value_cents, d.value_cents, 0)`;

export async function getSellerGoalSettings(): Promise<SellerGoalSettings> {
  const [r] = await db.select().from(settings).where(eq(settings.key, "seller_goals"));
  return (r?.value ?? {}) as SellerGoalSettings;
}

export type SellerMonth = { actual: SellerActuals; bonusSales: number; bonusReais: number; monthLabel: string };

/** Realizado do mês (horário de Brasília) de um vendedor. `month` = "AAAA-MM" (padrão: o mês atual). */
export async function getSellerMonth(userId: number, month?: string): Promise<SellerMonth> {
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : new Intl.DateTimeFormat("en-CA", { timeZone: SP, year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const first = `${ym}-01`;
  const evMonth = sql`(e.at at time zone ${SP})::date >= ${first}::date and (e.at at time zone ${SP})::date < (${first}::date + interval '1 month')`;
  const dMonth = sql`${closedDay} >= ${first}::date and ${closedDay} < (${first}::date + interval '1 month')`;
  const [calls, engaged, quotes, sold, react, bonus] = await Promise.all([
    db.execute<{ n: number }>(sql`select count(*)::int as n from deal_events e join deals d on d.id = e.deal_id where not d.is_test and e.user_id = ${userId} and e.kind = 'ligacao' and ${evMonth}`),
    db.execute<{ n: number }>(sql`select count(distinct d.lead_id)::int as n from deal_events e join deals d on d.id = e.deal_id where not d.is_test and e.user_id = ${userId} and e.kind in ('ligacao','whatsapp','email') and ${evMonth}`),
    // cotações: por negociação, vale o valor real quando o vendedor informou; senão a soma das cotações do mês, sem impostos
    db.execute<{ v: number }>(sql`select coalesce(sum(coalesce(x.real, x.net)),0)::bigint as v from (select d.id, max(d.real_value_cents) as real, sum(coalesce(q.net_cents, q.total_cents)) as net from deal_quotes q join deals d on d.id = q.deal_id where not d.is_test and q.created_by = ${userId} and (q.created_at at time zone ${SP})::date >= ${first}::date and (q.created_at at time zone ${SP})::date < (${first}::date + interval '1 month') group by d.id) x`),
    db.execute<{ v: number }>(sql`select coalesce(sum(${soldCents}),0)::bigint as v from deals d where not d.is_test and d.seller_id = ${userId} and d.stage = 'ganho' and ${dMonth}`),
    db.execute<{ n: number }>(sql`select count(*)::int as n from deals d where not d.is_test and d.seller_id = ${userId} and d.stage = 'ganho' and d.is_reactivation and ${dMonth}`),
    // bônus: só a primeira venda de cada cliente (a mais antiga de todas) e só se for deste vendedor, neste mês
    db.execute<{ n: number }>(sql`select count(*)::int as n from (
        select distinct on (d.lead_id) d.id, d.seller_id, ${closedDay} as day from deals d where not d.is_test and d.stage = 'ganho' order by d.lead_id, ${closedDay}, d.id) f
      where f.seller_id = ${userId} and f.day >= ${first}::date and f.day < (${first}::date + interval '1 month')`),
  ]);
  const bonusSales = bonus[0]?.n ?? 0;
  const [y, m] = ym.split("-").map(Number);
  return {
    actual: { calls: calls[0]?.n ?? 0, engaged: engaged[0]?.n ?? 0, quotes: Number(quotes[0]?.v ?? 0) / 100, sold: Number(sold[0]?.v ?? 0) / 100, reactivated: react[0]?.n ?? 0 },
    bonusSales, bonusReais: bonusSales * SALE_BONUS_REAIS,
    monthLabel: new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

export { resolveSellerGoals };
