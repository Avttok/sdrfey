import { and, desc, eq, gt, sql } from "drizzle-orm";
import { attendanceSessions, db, leads } from "@/db";

/** O que a pessoa está fazendo agora: lead aberto no atendimento (sessão sem desfecho, aberta há menos de 3 h). */
export async function currentActivity(userId: number): Promise<string | null> {
  try {
    const [r] = await db
      .select({ company: leads.company })
      .from(attendanceSessions)
      .innerJoin(leads, eq(leads.id, attendanceSessions.leadId))
      .where(and(eq(attendanceSessions.userId, userId), sql`${attendanceSessions.outcome} is null`, gt(attendanceSessions.shownAt, sql`now() - interval '3 hours'`)))
      .orderBy(desc(attendanceSessions.shownAt))
      .limit(1);
    return r?.company ?? null;
  } catch { return null; }
}
