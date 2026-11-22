import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { GoalPills } from "@/components/goal-tiles";
import { ShuffleHero } from "@/components/shuffle-hero";
import { db } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";
import { startSalesListAction } from "@/modules/lists/actions";
import { activeList } from "@/modules/lists/queries";
import { listScripts } from "@/modules/scripts/list";
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
    const [lead, catalog, templates, settings] = await Promise.all([getLeadView(open.leadId), getTagCatalog(), getActiveTemplates(me.id), getSettings()]);
    if (lead) return <AttendFlow scripts={await listScripts(me.id)} autoEnrichOn={settings.auto_enrich === 1} sales={{ shuffleId: open.id }} lead={lead} catalog={catalog} templates={templates} myName={me.name} showMap={me.mapMode === "map"} previous={null} doneToday={0} scheduledToday={0} goals={effectiveGoals(me, settings)} sellers={[]} />;
  }

  const today = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
  const [[r], stock] = await Promise.all([
    db.execute<{ worked: number; deals: number }>(sql`select
      (select count(*) from seller_shuffles where user_id = ${me.id} and not is_test and done_at >= ${today})::int as worked,
      (select count(*) from seller_shuffles where user_id = ${me.id} and not is_test and outcome = 'deal' and done_at >= ${today})::int as deals`),
    inactiveStock(),
  ]);
  const al = me.permissions["tab.lista_flow_vendas"] || me.isAdmin ? await activeList(me.id, "vendas") : null;
  return (
    <ShuffleHero list={al && al.count > 0 ? { action: startSalesListAction, name: al.name, count: al.count, href: "/lista-flow-vendas" } : undefined} title="Shuffler Vendas" avatar={me.avatar} roles={me.shownRoles} action={startSalesShuffleAction} empty={stock > 0 ? undefined : { hint: "Nenhum lead inativo livre agora. Quando o time liberar novos (ou algum voltar da espera), eles aparecem aqui." }}>
      <GoalPills items={[
        { icon: "shuffle", label: "Trabalhados hoje", value: r?.worked ?? 0 },
        { icon: "handshake", label: "Negociações abertas hoje", value: r?.deals ?? 0 },
        { icon: "inactive", label: "Leads Inativos", value: stock, plain: true },
      ]} />
    </ShuffleHero>
  );
}
