import { eq, sql } from "drizzle-orm";
import { users } from "@/db";
import { getSettings } from "@/modules/settings/get";
import { ACHIEVEMENTS, groupsFor } from "@/config/achievements";
import { SHOP_BY_KEY, TASK_COINS, achievementCoins } from "@/config/shop";
import { chatStyles, coinLedger, db, shopPurchases } from "@/db";
import { achievementsOf } from "@/modules/achievements/stats";

const g = globalThis as unknown as { __coinSync?: Map<number, number> };
const SYNC_EVERY_MS = 20_000;

/**
 * Paga as moedas devidas: uma linha por feito (ref única), então rodar várias vezes nunca paga em dobro.
 * Feitos de teste não contam. Limitada a uma vez a cada 20 s por pessoa.
 */
export async function syncCoins(uid: number, roles: readonly string[]): Promise<void> {
  const map = (g.__coinSync ??= new Map());
  const last = map.get(uid) ?? 0;
  if (Date.now() - last < SYNC_EVERY_MS) return;
  map.set(uid, Date.now());
  // Bloqueado (pelo Adm, para todos ou só esta pessoa): os feitos são registrados com 0 moedas, então ao liberar não pagam o passado.
  const [[who], settings] = await Promise.all([db.select({ b: users.coinsEarnBlocked }).from(users).where(eq(users.id, uid)), getSettings()]);
  const blocked = !!who?.b || settings.coins_earn_on !== 1;
  const T = blocked ? { attended: 0, visit: 0, deal: 0, quote: 0, billed: 0, shuffled: 0 } : TASK_COINS;
  await db.execute(sql`
    insert into coin_ledger (user_id, amount, reason, ref)
    select ${uid}::int, ${T.attended}::int, 'Lead atendido', 'att:' || id from attendance_sessions where user_id = ${uid} and outcome = 'saved' and not is_test
    union all select ${uid}::int, ${T.visit}::int, 'Visita agendada', 'vis:' || id from visits where user_id = ${uid} and canceled_at is null
    union all select ${uid}::int, ${T.deal}::int, 'Negociação aberta', 'deal:' || id from deals where (sdr_id = ${uid} or seller_id = ${uid}) and not is_test
    union all select ${uid}::int, ${T.quote}::int, 'Cotação enviada', 'quote:' || q.id from deal_quotes q join deals d on d.id = q.deal_id where q.created_by = ${uid} and not d.is_test
    union all select ${uid}::int, ${T.billed}::int, 'Venda faturada', 'bill:' || id from deals where seller_id = ${uid} and not is_test and stage = 'ganho'
    union all select ${uid}::int, ${T.shuffled}::int, 'Inativo trabalhado', 'shuf:' || id from seller_shuffles where user_id = ${uid} and not is_test and outcome in ('deal', 'no_answer', 'no_interest', 'skipped')
    on conflict (user_id, ref) do nothing`);
  const { list } = await achievementsOf(uid, roles);
  const got = list.filter((a) => a.earned);
  if (got.length) {
    await db.insert(coinLedger).values(got.map((a) => ({ userId: uid, amount: blocked ? 0 : achievementCoins(a.goal), reason: `Conquista: ${a.name}`, ref: `ach:${a.key}` }))).onConflictDoNothing();
  }
}

export async function coinBalance(uid: number): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${coinLedger.amount}), 0)::int` }).from(coinLedger).where(eq(coinLedger.userId, uid));
  return r?.n ?? 0;
}

export type ShopState = { balance: number; owned: string[]; equipped: Record<string, string> };
export async function shopState(uid: number, roles: readonly string[]): Promise<ShopState> {
  await syncCoins(uid, roles);
  const [balance, owned, [st]] = await Promise.all([
    coinBalance(uid),
    db.select({ k: shopPurchases.itemKey }).from(shopPurchases).where(eq(shopPurchases.userId, uid)),
    db.select().from(chatStyles).where(eq(chatStyles.userId, uid)),
  ]);
  return { balance, owned: owned.map((o) => o.k), equipped: st?.equipped ?? {} };
}

export { ACHIEVEMENTS, groupsFor, SHOP_BY_KEY };
