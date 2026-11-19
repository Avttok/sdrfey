import { sql } from "drizzle-orm";
import { db } from "@/db";
import { leftPortfolio } from "@/modules/deals/portfolio";

/** Minutos que um lead fica reservado para quem o sorteou, antes de voltar ao estoque. */
export const SALES_HOLD_MIN = 60;
/** Dias de descanso de um lead depois de cada resultado, antes de poder ser sorteado de novo. */
export const REST_DAYS = { no_answer: 3, skipped: 2, no_interest: 30, released: 0 } as const;

export type SalesShuffle = { id: number; leadId: number };

/** Passagem aberta da pessoa (se ainda dentro do prazo). */
export async function openShuffle(userId: number): Promise<SalesShuffle | null> {
  const [r] = await db.execute<{ id: number; lead_id: number }>(sql`
    select id, lead_id from seller_shuffles
    where user_id = ${userId} and outcome is null and shown_at > now() - make_interval(mins => ${SALES_HOLD_MIN})
    order by id desc limit 1`);
  return r ? { id: r.id, leadId: r.lead_id } : null;
}

/**
 * Sorteia um lead inativo para o vendedor. Se ele já tem um em mãos, devolve o mesmo.
 * Uma trava de transação evita que dois vendedores recebam o mesmo lead ao mesmo tempo.
 */
export async function claimInactive(userId: number): Promise<SalesShuffle | null> {
  const mine = await openShuffle(userId);
  if (mine) return mine;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('seller_shuffle'))`);
    await tx.execute(sql`update seller_shuffles set outcome = 'released', done_at = now() where user_id = ${userId} and outcome is null`);
    const [pick] = await tx.execute<{ id: number }>(sql`
      select l.id from leads l
      where l.kind = 'inativo' and not l.is_test and l.locked_by is null
        and not exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))
        and not ${leftPortfolio(sql`l.id`)}
        and not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.blocks_sorting)
        and not exists (select 1 from seller_shuffles s where s.lead_id = l.id and s.outcome is null and s.shown_at > now() - make_interval(mins => ${SALES_HOLD_MIN}))
        and not exists (select 1 from seller_shuffles s where s.lead_id = l.id and s.done_at is not null and (
              (s.outcome = 'no_interest' and s.done_at > now() - make_interval(days => ${REST_DAYS.no_interest}))
           or (s.outcome = 'no_answer' and s.done_at > now() - make_interval(days => ${REST_DAYS.no_answer}))
           or (s.outcome = 'skipped' and s.user_id = ${userId} and s.done_at > now() - make_interval(days => ${REST_DAYS.skipped}))
           or (s.outcome = 'deal')))
      order by random() limit 1`);
    if (!pick) return null;
    const [row] = await tx.execute<{ id: number }>(sql`insert into seller_shuffles (lead_id, user_id) values (${pick.id}, ${userId}) returning id`);
    return { id: row.id, leadId: pick.id };
  });
}

/** Quantos leads inativos ainda podem ser sorteados agora (para a tela inicial). */
export async function inactiveStock(): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from leads l
    where l.kind = 'inativo' and not l.is_test
      and not exists (select 1 from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido'))
      and not exists (select 1 from seller_shuffles s where s.lead_id = l.id and s.done_at is not null and (
            (s.outcome = 'no_interest' and s.done_at > now() - make_interval(days => ${REST_DAYS.no_interest}))
         or (s.outcome = 'no_answer' and s.done_at > now() - make_interval(days => ${REST_DAYS.no_answer}))
         or s.outcome = 'deal'))`);
  return r?.n ?? 0;
}
