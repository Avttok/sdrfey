"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { achievementOverrides, chatStyles, coinLedger, db, eggNotes, shopPurchases, users } from "@/db";
import { EGG_SECRET_ITEMS } from "@/config/shop";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";

/**
 * Admin: tira o status "achou o segredo" de uma pessoa (ela pode refazer a jornada).
 * `wipe` = também tira as 1.000 moedas, os itens exclusivos da loja (e os desequipa); sem isso, ela fica com o que já ganhou.
 * Em qualquer caso o post-it dela sai do mural e a medalha manual do Douradovo é desfeita.
 */
export async function revokeEggAction(userId: number, wipe: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return { ok: false, message: "Pessoa não encontrada." };
  await db.transaction(async (tx) => {
    if (wipe) await tx.delete(coinLedger).where(and(eq(coinLedger.userId, userId), eq(coinLedger.ref, "egg:done")));
    else await tx.update(coinLedger).set({ ref: sql`'egg:revoked:' || ${coinLedger.id}` }).where(and(eq(coinLedger.userId, userId), eq(coinLedger.ref, "egg:done")));
    await tx.delete(achievementOverrides).where(and(eq(achievementOverrides.userId, userId), eq(achievementOverrides.key, "egg")));
    await tx.delete(eggNotes).where(eq(eggNotes.userId, userId));
    if (wipe) {
      const keys = EGG_SECRET_ITEMS.map((i) => i.key);
      await tx.delete(shopPurchases).where(and(eq(shopPurchases.userId, userId), inArray(shopPurchases.itemKey, keys)));
      const [st] = await tx.select({ e: chatStyles.equipped }).from(chatStyles).where(eq(chatStyles.userId, userId));
      if (st) {
        const eq2 = Object.fromEntries(Object.entries(st.e ?? {}).filter(([, v]) => !keys.includes(v as string)));
        await tx.update(chatStyles).set({ equipped: eq2 }).where(eq(chatStyles.userId, userId));
      }
    }
    await logAudit(tx, { userId: me.id, entity: "user", action: "removeu o Douradovo", field: u.name, newValue: wipe ? "com moedas e itens" : "só o status" });
  });
  revalidatePath("/admin/moedas"); revalidatePath("/conquistas");
  return { ok: true, message: `Status do Douradovo removido de ${u.name}.` };
}
