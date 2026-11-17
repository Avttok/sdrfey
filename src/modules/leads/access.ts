import { and, eq, sql } from "drizzle-orm";
import { db, deals } from "@/db";
import { requireUser, type CurrentUser } from "@/modules/auth/guard";
import { leftPortfolio } from "@/modules/deals/portfolio";

/** Quem pode editar os dados de um lead: quem tem “editar qualquer lead”, ou o vendedor que está com a negociação dele. As tags continuam só para a gestão. */
export async function leadEditor(leadId: number): Promise<CurrentUser | null> {
  const me = await requireUser();
  if (me.permissions["lead.edit"]) return me;
  if (!me.roles.includes("seller")) return null;
  const [d] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.leadId, leadId), eq(deals.sellerId, me.id), sql`not ${leftPortfolio(sql`${leadId}`)}`)).limit(1);
  return d ? me : null;
}
