import type { Metadata } from "next";
import { Play } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { SubmitButton } from "@/components/submit-button";
import { panelCls } from "@/components/ui";
import { attendanceSessions, db, leads, visits } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { startAction } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";
import { getActiveTemplates, getLeadView, getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Shufflar" };
export const dynamic = "force-dynamic";

export default async function AttendPage() {
  const me = await requirePerm("tab.comecar");
  const [mine] = await db.select({ id: leads.id }).from(leads).where(eq(leads.lockedBy, me.id)).limit(1);
  const lead = mine ? await getLeadView(mine.id) : null;

  if (!lead) {
    return (
      <div className={`${panelCls} flex flex-wrap items-center justify-between gap-4 p-6`}>
        <div className="max-w-lg">
          <h1 className="display text-2xl">Pronto para o próximo lead?</h1>
          <p className="mt-2 text-muted">O sistema escolhe um lead livre para você. Se quiser um específico, use ATENDER na aba Leads ou no seu histórico.</p>
        </div>
        <form action={startAction}>
          <SubmitButton><Play size={18} aria-hidden /> Shufflar</SubmitButton>
        </form>
      </div>
    );
  }

  const [catalog, templates, settings, [done], [sched]] = await Promise.all([
    getTagCatalog(),
    getActiveTemplates(),
    getSettings(),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(attendanceSessions)
      .where(and(eq(attendanceSessions.userId, me.id), eq(attendanceSessions.outcome, "saved"), eq(attendanceSessions.isTest, false), sql`${attendanceSessions.savedAt} >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`)),
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(and(eq(visits.userId, me.id), sql`${visits.canceledAt} is null`, sql`${visits.createdAt} >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`)),
  ]);
  return <AttendFlow lead={lead} catalog={catalog} templates={templates} myName={me.name} doneToday={done?.n ?? 0} scheduledToday={sched?.n ?? 0} goals={effectiveGoals(me, settings)} />;
}
