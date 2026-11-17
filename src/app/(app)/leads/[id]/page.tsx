import { leftPortfolio } from "@/modules/deals/portfolio";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { LeadEditor } from "@/components/lead-editor";
import { bubbleHex } from "@/config/theme";
import { db, users } from "@/db";
import { isSellerOnly } from "@/config/roles";
import { sql } from "drizzle-orm";
import { requirePerm } from "@/modules/auth/guard";
import { getLeadView, getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("tab.leads");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lead = await getLeadView(id);
  if (!lead || lead.isTest) notFound();
  const sellerView = isSellerOnly(me.roles);
  let dealId: number | null = null;
  let ownDeal = false;
  if (sellerView) {
    const r = await db.execute<{ id: number; seller_id: number | null }>(sql`select id, seller_id from deals where lead_id = ${id} and (seller_id = ${me.id} or seller_id is null) and not ${leftPortfolio(sql`${id}`)} order by created_at desc limit 1`);
    if (!r[0]) notFound();
    dealId = r[0].id;
    ownDeal = r[0].seller_id === me.id;
  }
  const [anyDeal] = await db.execute<{ id: number }>(sql`select id from deals where lead_id = ${id} limit 1`);
  const [catalog, owners, locker] = await Promise.all([
    getTagCatalog(),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    lead.lockedBy ? db.select({ name: users.name, accent: users.accent, roles: users.roles, id: users.id }).from(users).where(eq(users.id, lead.lockedBy)) : Promise.resolve([]),
  ]);
  return <LeadEditor sellerView={sellerView} dealId={dealId} meId={me.id} showMap={me.mapMode === "map"} lead={lead} catalog={catalog} owners={owners} canEdit={!!me.permissions["lead.edit"] || ownDeal} inDeal={!!anyDeal} canRelease={!!me.permissions["lead.release"]} lockedBy={locker[0] ? { name: locker[0].name, hex: bubbleHex(locker[0].accent, locker[0].id, locker[0].roles) } : null} />;
}
