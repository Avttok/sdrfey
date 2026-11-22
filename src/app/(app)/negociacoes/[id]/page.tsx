import { visibleUsers } from "@/modules/auth/visibility";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { DealPanel } from "@/components/deals/deal-panel";
import { db, leadChannels, leadPeople, users } from "@/db";
import { getScriptRuns } from "@/modules/scripts/runs-query";
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
  const [commercial, history, runs, peopleRows, chans] = await Promise.all([
    getLeadCommercial(row.leadId), getClientHistory(row.leadId), getScriptRuns(row.leadId),
    db.select().from(leadPeople).where(eq(leadPeople.leadId, row.leadId)).orderBy(asc(leadPeople.id)),
    db.select().from(leadChannels).where(and(eq(leadChannels.leadId, row.leadId), eq(leadChannels.wrong, false))),
  ]);
  const people = peopleRows.map((p) => ({ id: p.id, name: p.name, roleTitle: p.roleTitle, extension: p.extension, notes: p.notes, phones: chans.filter((c) => c.personId === p.id && c.kind === "phone").map((c) => c.value), emails: chans.filter((c) => c.personId === p.id && c.kind === "email").map((c) => c.value) }));
  const sellers = team ? await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, visibleUsers(me))).orderBy(asc(users.name)) : [];
  return (
    <div className="space-y-4">
      <Link href="/negociacoes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden /> Negociações</Link>
      <DealPanel runs={runs} people={people} deal={row} events={extra.events} quotes={extra.quotes} tags={extra.tags} terms={extra.terms} extraPct={extra.extraPct} icmsPct={extra.icmsPct} icmsRatePct={extra.icmsRatePct} canDelete={!!me.permissions["deals.delete"]} phones={extra.phones} meId={me.id} team={team} canClaim={me.roles.includes("seller") || team} sellers={sellers} visits={commercial.visits} clientEvents={commercial.events} history={history} />
    </div>
  );
}
