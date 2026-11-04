import type { Metadata } from "next";
import { Play } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { AttendFlow } from "@/components/attend-flow";
import { btnPrimary, panelCls } from "@/components/ui";
import { attendanceSessions, db, leads } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { startAction } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";
import { getActiveTemplates, getLeadView, getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Começar" };
export const dynamic = "force-dynamic";

export default async function AttendPage() {
  const me = await requireUser();
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
          <button type="submit" className={btnPrimary}><Play size={18} aria-hidden /> Começar</button>
        </form>
      </div>
    );
  }

  const [catalog, templates, settings, [done]] = await Promise.all([
    getTagCatalog(),
    getActiveTemplates(),
    getSettings(),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(attendanceSessions)
      .where(and(eq(attendanceSessions.userId, me.id), eq(attendanceSessions.outcome, "saved"), eq(attendanceSessions.isTest, false), sql`${attendanceSessions.savedAt} >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`)),
  ]);
  return <AttendFlow lead={lead} catalog={catalog} templates={templates} myName={me.name} doneToday={done?.n ?? 0} goal={settings.daily_goal} />;
}
