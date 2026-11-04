import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { LeadEditor } from "@/components/lead-editor";
import { db, users } from "@/db";
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
  const [catalog, owners, locker] = await Promise.all([
    getTagCatalog(),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
    lead.lockedBy ? db.select({ name: users.name }).from(users).where(eq(users.id, lead.lockedBy)) : Promise.resolve([]),
  ]);
  return <LeadEditor lead={lead} catalog={catalog} owners={owners} canEdit={!!me.permissions["lead.edit"]} canRelease={!!me.permissions["lead.release"]} lockedByName={locker[0]?.name ?? null} />;
}
