import { visibleUsers } from "@/modules/auth/visibility";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { DealPanel } from "@/components/deals/deal-panel";
import { db, users } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { getClientHistory } from "@/modules/deals/history";
import { getLeadCommercial } from "@/modules/deals/lead-commercial";
import { getDeal, listDeals } from "@/modules/deals/queries";

export const metadata: Metadata = { title: "Negociação" };
export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("tab.negociacoes");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const team = !!me.permissions["deals.team"];
  const row = (await listDeals(me.id, team, { includeTest: true })).find((d) => d.id === id);
  if (!row) notFound();
  const extra = await getDeal(id);
  if (!extra) notFound();
  const [commercial, history] = await Promise.all([getLeadCommercial(row.leadId), getClientHistory(row.leadId)]);
  const sellers = team ? await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, visibleUsers(me))).orderBy(asc(users.name)) : [];
  return (
    <div className="space-y-4">
      <Link href="/negociacoes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden /> Negociações</Link>
      <DealPanel deal={row} events={extra.events} quotes={extra.quotes} tags={extra.tags} terms={extra.terms} extraPct={extra.extraPct} icmsPct={extra.icmsPct} icmsRatePct={extra.icmsRatePct} canDelete={!!me.permissions["deals.delete"]} phones={extra.phones} meId={me.id} team={team} canClaim={me.roles.includes("seller") || team} sellers={sellers} visits={commercial.visits} clientEvents={commercial.events} history={history} />
    </div>
  );
}
