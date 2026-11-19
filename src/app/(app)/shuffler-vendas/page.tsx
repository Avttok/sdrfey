import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { GoalPills } from "@/components/goal-tiles";
import { ShuffleHero } from "@/components/shuffle-hero";
import { db } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";
import { getActiveTemplates, getLeadView, getTagCatalog } from "@/modules/leads/view";
import { startSalesShuffleAction } from "@/modules/sales/actions";
import { inactiveStock, openShuffle } from "@/modules/sales/shuffler";

export const metadata: Metadata = { title: "Shuffler de vendas" };
export const dynamic = "force-dynamic";

export default async function SalesShufflePage() {
  const me = await requirePerm("tab.shuffler_vendas");
  const open = await openShuffle(me.id);
  if (open) {
    // mesmo fluxo do SDR (perfil, e-mail, WhatsApp, ligação, finalizar), só que com os destinos do vendedor
    const [lead, catalog, templates, settings] = await Promise.all([getLeadView(open.leadId), getTagCatalog(), getActiveTemplates(), getSettings()]);
    if (lead) return <AttendFlow sales={{ shuffleId: open.id }} lead={lead} catalog={catalog} templates={templates} myName={me.name} showMap={me.mapMode === "map"} previous={null} doneToday={0} scheduledToday={0} goals={effectiveGoals(me, settings)} sellers={[]} />;
  }

  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const [[r], stock] = await Promise.all([
    db.execute<{ worked: number; deals: number }>(sql`select
      (select count(*) from seller_shuffles where user_id = ${me.id} and not is_test and done_at >= ${today})::int as worked,
      (select count(*) from seller_shuffles where user_id = ${me.id} and not is_test and outcome = 'deal' and done_at >= ${today})::int as deals`),
    inactiveStock(),
  ]);
  return (
    <ShuffleHero avatar={me.avatar} roles={me.roles} action={startSalesShuffleAction}>
      <GoalPills items={[
        { icon: "shuffle", label: "Trabalhados hoje", value: r?.worked ?? 0 },
        { icon: "handshake", label: "Negociações abertas hoje", value: r?.deals ?? 0 },
        { icon: "inactive", label: "Inativos livres", value: stock, plain: true },
      ]} />
    </ShuffleHero>
  );
}
