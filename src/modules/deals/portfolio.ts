import { sql } from "drizzle-orm";

const SP = "America/Sao_Paulo";
/** Primeiro dia do mês atual (Brasília), como data. */
export const monthStart = sql`(date_trunc('month', now() at time zone ${SP}))::date`;

/** Cliente com venda em mês anterior: saiu da carteira (vai para vendas futuras, fora do sistema). Fica bloqueado. */
export const leftPortfolio = (leadId: ReturnType<typeof sql> | string) =>
  sql`exists (select 1 from deals w where w.lead_id = ${typeof leadId === "string" ? sql.raw(leadId) : leadId} and w.stage = 'ganho' and not w.is_test and coalesce(w.closed_on, (w.closed_at at time zone ${SP})::date) < ${monthStart})`;

/** Mesma regra no JS: venda fechada antes do 1º dia do mês atual. */
export function soldBeforeThisMonth(d: { stage: string; closedOn: string | null; closedAt: string | null }, now = new Date()): boolean {
  if (d.stage !== "ganho") return false;
  const day = d.closedOn ?? (d.closedAt ? new Intl.DateTimeFormat("en-CA", { timeZone: SP }).format(new Date(d.closedAt)) : null);
  if (!day) return false;
  const first = `${new Intl.DateTimeFormat("en-CA", { timeZone: SP }).format(now).slice(0, 7)}-01`;
  return day < first;
}
