import { EoxConsultButton } from "@/components/eox-consult-button";
import { visibleUsers } from "@/modules/auth/visibility";
import { leftPortfolio } from "@/modules/deals/portfolio";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { AdminDelete } from "@/components/admin/admin-delete";
import { deleteRecordAction } from "@/modules/admin/purge";
import { LeadEditor } from "@/components/lead-editor";
import { bubbleHex } from "@/config/theme";
import { db, users } from "@/db";
import { hasRole, isSellerOnly } from "@/config/roles";
import { sql } from "drizzle-orm";
import { requirePerm } from "@/modules/auth/guard";
import { getLeadCommercial } from "@/modules/deals/lead-commercial";
import { getLeadView, getTagCatalog } from "@/modules/leads/view";
import { LeadKpis, LeadRecords } from "@/components/lead-extras";
import { getScriptRuns } from "@/modules/scripts/runs-query";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("tab.leads");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lead = await getLeadView(id);
  if (!lead || lead.isTest) notFound();
  const sellerView = isSellerOnly(me.roles);
  const [kindRow] = await db.execute<{ kind: string }>(sql`select kind from leads where id = ${id}`);
  const inactive = kindRow?.kind === "inativo";
  let dealId: number | null = null;
  let ownDeal = false;
  if (sellerView) {
    const r = await db.execute<{ id: number; seller_id: number | null }>(sql`select id, seller_id from deals where lead_id = ${id} and (seller_id = ${me.id} or seller_id is null) and not ${leftPortfolio(sql`${id}`)} order by created_at desc limit 1`);
    if (!r[0]) notFound();
    dealId = r[0].id;
    ownDeal = r[0].seller_id === me.id;
  }
  else if (me.roles.includes("seller")) {
    // SDR + Vendedor: além do atendimento, vê o atalho para a própria negociação.
    const r = await db.execute<{ id: number }>(sql`select id from deals where lead_id = ${id} and seller_id = ${me.id} and not ${leftPortfolio(sql`${id}`)} order by created_at desc limit 1`);
    if (r[0]) { dealId = r[0].id; ownDeal = true; }
  }
  const [anyDeal] = await db.execute<{ id: number; sname: string | null; sid: number | null; saccent: string | null; sroles: import("@/config/roles").Role[] | null }>(sql`select d.id, u.name as sname, u.id as sid, u.accent as saccent, u.roles as sroles from deals d left join users u on u.id = d.seller_id where d.lead_id = ${id} order by d.created_at desc limit 1`);
  const dealSeller = anyDeal?.sname ? { name: anyDeal.sname, hex: bubbleHex(anyDeal.saccent, anyDeal.sid ?? 0, anyDeal.sroles ?? undefined) } : null;
  const [catalog, owners, locker] = await Promise.all([
    getTagCatalog(),
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name)),
    lead.lockedBy ? db.select({ name: users.name, accent: users.accent, roles: users.roles, id: users.id }).from(users).where(eq(users.id, lead.lockedBy)) : Promise.resolve([]),
  ]);
  const showCommercial = !!me.permissions["tab.negociacoes"] || me.roles.includes("manager") || me.roles.includes("admin");
  const comm = showCommercial ? await getLeadCommercial(id, sellerView ? (dealId ? [dealId] : []) : undefined) : null;
  const scriptRuns = await getScriptRuns(id).catch(() => []);
  const tc = await db.execute<{ channel: string; n: number }>(sql`select channel, count(*)::int as n from contact_events where lead_id = ${id} and not is_test group by channel`).catch(() => []);
  const th = await db.execute<{ ref: string; n: number }>(sql`select t.group_key || ':' || t.key as ref, count(*)::int as n from lead_tag_hits h join tags t on t.id = h.tag_id where h.lead_id = ${id} group by 1`).catch(() => []);
  const tagCounts: Record<string, number> = Object.fromEntries(th.map((r) => [r.ref, Number(r.n)]));
  const touchCounts = { ligacao: Number(tc.find((r) => r.channel === "call")?.n ?? 0), whatsapp: Number(tc.find((r) => r.channel === "whatsapp")?.n ?? 0), email: Number(tc.find((r) => r.channel === "email")?.n ?? 0) };
  return (
    <div className="space-y-4">
      <LeadEditor canSales={!sellerView && hasRole(me.roles, "seller") && !!me.permissions["tab.shuffler_vendas"]} inactive={inactive} canAttend={!!me.permissions["tab.comecar"]} tagCounts={tagCounts} touchCounts={touchCounts} adminDelete={me.isAdmin ? (<span className="inline-flex flex-wrap items-center gap-2"><EoxConsultButton leadId={id} /><AdminDelete label="Apagar lead (Adm)" title={`Apagar ${lead.tradeName ?? lead.company}?`} body="O cadastro e tudo ligado a ele serão apagados: negociações, cotações, visitas, interações, tags, contatos e atendimentos." action={deleteRecordAction.bind(null, { kind: "lead", id, withHistory: false })} then="/leads" /></span>) : null} kpis={<LeadKpis comm={comm} runs={scriptRuns} people={lead.people.length} channels={lead.channels.filter((c) => !c.wrong).length} lastAt={null} />} records={<LeadRecords comm={comm} runs={scriptRuns} showVisits={sellerView} />} dealSeller={dealSeller} sellerView={sellerView} dealId={dealId} meId={me.id} showMap={me.mapMode === "map"} lead={lead} catalog={catalog} owners={owners} canEdit={!!me.permissions["lead.edit"] || ownDeal} inDeal={!!anyDeal} canRelease={!!me.permissions["lead.release"]} lockedBy={locker[0] ? { name: locker[0].name, hex: bubbleHex(locker[0].accent, locker[0].id, locker[0].roles) } : null} />
    </div>
  );
}
