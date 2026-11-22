import { sql } from "drizzle-orm";
import { Coins } from "lucide-react";
import { CoinsAdmin, type CoinRow } from "@/components/admin/coins-admin";
import { PageHead } from "@/components/page-head";
import { db } from "@/db";
import { getSettings } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [rows, s] = await Promise.all([
    db.execute<CoinRow>(sql`select u.id, u.name, exists (select 1 from coin_ledger e where e.user_id = u.id and e.ref = 'egg:done') as egg, u.username, u.accent, u.roles, u.coins_earn_blocked as "earnBlocked", u.coins_spend_blocked as "spendBlocked",
      coalesce(sum(c.amount), 0)::int as balance, coalesce(sum(c.amount) filter (where c.amount > 0), 0)::int as earned, coalesce(-sum(c.amount) filter (where c.amount < 0), 0)::int as spent
      from users u left join coin_ledger c on c.user_id = u.id where u.active group by u.id order by u.name`),
    getSettings(),
  ]);
  return (
    <div className="space-y-5">
      <PageHead icon={Coins} size="md" title="Moedas e pontos" subtitle="Ajuste saldos, bloqueie ganho ou gasto (de todos ou de uma pessoa) e veja o extrato." />
      <CoinsAdmin rows={[...rows]} earnOn={s.coins_earn_on === 1} spendOn={s.coins_spend_on === 1} rewards={{ coin_attended: s.coin_attended, coin_visit: s.coin_visit, coin_deal: s.coin_deal, coin_quote: s.coin_quote, coin_billed: s.coin_billed, coin_shuffled: s.coin_shuffled }} />
    </div>
  );
}
