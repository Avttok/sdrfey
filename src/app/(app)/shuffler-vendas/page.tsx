import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { SalesShuffleFlow } from "@/components/sales-shuffle-flow";
import { CountUp } from "@/components/goal-tiles";
import { ShuffleHero } from "@/components/shuffle-hero";
import { db } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { getClientHistory } from "@/modules/deals/history";
import { startSalesShuffleAction } from "@/modules/sales/actions";
import { inactiveStock, openShuffle } from "@/modules/sales/shuffler";

export const metadata: Metadata = { title: "Shuffler de vendas" };
export const dynamic = "force-dynamic";

export default async function SalesShufflePage() {
  const me = await requirePerm("tab.shuffler_vendas");
  const open = await openShuffle(me.id);
  const h = open ? await getClientHistory(open.leadId) : null;
  if (open && h) return <SalesShuffleFlow shuffleId={open.id} h={h} />;

  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const [[r], stock] = await Promise.all([
    db.execute<{ worked: number; deals: number }>(sql`select
      (select count(*) from seller_shuffles where user_id = ${me.id} and not is_test and done_at >= ${today})::int as worked,
      (select count(*) from seller_shuffles where user_id = ${me.id} and not is_test and outcome = 'deal' and done_at >= ${today})::int as deals`),
    inactiveStock(),
  ]);
  return (
    <ShuffleHero action={startSalesShuffleAction}>
      <ul className="mx-auto flex flex-wrap justify-center gap-4">
        {([["Trabalhados hoje", r?.worked ?? 0], ["Negociações hoje", r?.deals ?? 0], ["Inativos livres", stock]] as const).map(([l, v], i) => (
          <li key={l} className="sh-rise w-40 rounded-3xl border border-line bg-panel/75 px-4 py-6 text-center shadow-lg backdrop-blur-sm sm:w-44" style={{ "--d": `${0.15 + i * 0.12}s` } as React.CSSProperties}>
            <p className="figure text-5xl font-bold leading-none"><CountUp to={v} /></p>
            <p className="mt-3 text-sm font-semibold text-muted">{l}</p>
          </li>
        ))}
      </ul>
    </ShuffleHero>
  );
}
