import { eq } from "drizzle-orm";
import { db, deals } from "@/db";
import { requirePerm, type CurrentUser } from "@/modules/auth/guard";

/** Carrega a negociação e confere se esta pessoa pode mexer nela (dona, ou gestor com “deals.team”). */
export async function loadDeal(id: number): Promise<{ me: CurrentUser; deal: typeof deals.$inferSelect } | { error: string }> {
  const me = await requirePerm("tab.negociacoes");
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  if (!deal) return { error: "Negociação não encontrada." };
  const team = !!me.permissions["deals.team"];
  if (deal.sellerId !== me.id && !team) return { error: deal.sellerId ? "Esta negociação é de outro vendedor." : "Assuma a negociação primeiro." };
  return { me, deal };
}

