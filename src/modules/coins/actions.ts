"use server";

import { logAudit } from "@/modules/audit/log";

import { and, eq, sql } from "drizzle-orm";
import { SHOP_BY_KEY } from "@/config/shop";
import { chatStyles, coinLedger, db, shopPurchases } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { shopState, type ShopState } from "./coins";

type R = ActionResult & { state?: ShopState };

export async function shopStateAction(): Promise<ShopState> {
  const me = await requireUser();
  return shopState(me.id, me.shownRoles);
}

/** Compra um item. O saldo é conferido dentro da transação, com a pessoa travada, para não gastar o mesmo dinheiro duas vezes. */
export async function buyItemAction(key: string): Promise<R> {
  const me = await requireUser();
  const item = SHOP_BY_KEY.get(key);
  if (!item) return { ok: false, message: "Item não encontrado." };
  await shopState(me.id, me.shownRoles);
  const res = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${me.id}::bigint + 7000000)`);
    const [have] = await tx.select().from(shopPurchases).where(and(eq(shopPurchases.userId, me.id), eq(shopPurchases.itemKey, key)));
    if (have) return { ok: false as const, message: "Você já tem este item." };
    const [b] = await tx.select({ n: sql<number>`coalesce(sum(${coinLedger.amount}), 0)::int` }).from(coinLedger).where(eq(coinLedger.userId, me.id));
    if ((b?.n ?? 0) < item.price) return { ok: false as const, message: `Faltam ${item.price - (b?.n ?? 0)} moedas.` };
    await tx.insert(shopPurchases).values({ userId: me.id, itemKey: key, price: item.price });
    await tx.insert(coinLedger).values({ userId: me.id, amount: -item.price, reason: `Loja: ${item.name}`, ref: `buy:${key}` });
    await logAudit(tx, { userId: me.id, entity: "shop", action: "comprou na loja", field: item.name, newValue: `${item.price} moedas` });
    return { ok: true as const, message: `${item.name} é seu!` };
  });
  return { ...res, state: await shopState(me.id, me.shownRoles) };
}

/** Veste (ou tira, com key vazia) um item comprado na sua categoria. */
export async function equipItemAction(cat: string, key: string | null): Promise<R> {
  const me = await requireUser();
  if (!["font", "color", "effect", "bubble"].includes(cat)) return { ok: false, message: "Categoria inválida." };
  const st = await shopState(me.id, me.shownRoles);
  if (key) {
    const item = SHOP_BY_KEY.get(key);
    if (!item || item.cat !== cat || !st.owned.includes(key)) return { ok: false, message: "Você ainda não tem este item." };
  }
  const equipped = { ...st.equipped };
  if (key) equipped[cat] = key; else delete equipped[cat];
  await logAudit(db, { userId: me.id, entity: "shop", action: key ? "vestiu item da loja" : "tirou item da loja", field: SHOP_BY_KEY.get(key ?? "")?.name ?? cat });
  await db.insert(chatStyles).values({ userId: me.id, equipped }).onConflictDoUpdate({ target: chatStyles.userId, set: { equipped } });
  return { ok: true, message: key ? "Aplicado!" : "Removido.", state: await shopState(me.id, me.shownRoles) };
}
