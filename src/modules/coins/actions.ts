"use server";

import { logAudit } from "@/modules/audit/log";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { SET_BY_KEY, SET_DISCOUNT, SHOP_BY_KEY, setPrice } from "@/config/shop";
import { chatStyles, coinLedger, db, shopPurchases, users } from "@/db";
import { getSettings } from "@/modules/settings/get";
import { requireUser } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { shopState, type ShopState } from "./coins";

type R = ActionResult & { state?: ShopState };

/** Veste os itens: o banner vai para o perfil da pessoa; o resto, para o estilo do chat. */
async function wear(tx: Pick<typeof db, "select" | "insert" | "update">, uid: number, keys: string[]) {
  const [cur] = await tx.select().from(chatStyles).where(eq(chatStyles.userId, uid));
  const equipped: Record<string, string> = { ...(cur?.equipped ?? {}) };
  for (const k of keys) {
    const it = SHOP_BY_KEY.get(k); if (!it) continue;
    if (it.cat === "banner") await tx.update(users).set({ banner: k }).where(eq(users.id, uid)); else equipped[it.cat] = k;
  }
  await tx.insert(chatStyles).values({ userId: uid, equipped }).onConflictDoUpdate({ target: chatStyles.userId, set: { equipped } });
}

export async function shopStateAction(): Promise<ShopState> {
  const me = await requireUser();
  return shopState(me.id, me.shownRoles);
}

/** Compra um item. O saldo é conferido dentro da transação, com a pessoa travada, para não gastar o mesmo dinheiro duas vezes. */
export async function buyItemAction(key: string): Promise<R> {
  const me = await requireUser();
  const item = SHOP_BY_KEY.get(key);
  if (!item || item.secret) return { ok: false, message: "Item não encontrado." };
  const [[who], settings] = await Promise.all([db.select({ b: users.coinsSpendBlocked }).from(users).where(eq(users.id, me.id)), getSettings()]);
  if (who?.b || settings.coins_spend_on !== 1) return { ok: false, message: "Os gastos de moedas estão bloqueados pelo Adm.", state: await shopState(me.id, me.shownRoles) };
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
    await wear(tx, me.id, [item.key]);
    return { ok: true as const, message: `${item.name} é seu — já está em uso!` };
  });
  if (res.ok) revalidatePath("/", "layout");
  return { ...res, state: await shopState(me.id, me.shownRoles) };
}

/** Veste (ou tira, com key vazia) um item comprado na sua categoria. */
export async function equipItemAction(cat: string, key: string | null): Promise<R> {
  const me = await requireUser();
  if (!["font", "color", "effect", "bubble", "banner"].includes(cat)) return { ok: false, message: "Categoria inválida." };
  const st = await shopState(me.id, me.shownRoles);
  if (key) {
    const item = SHOP_BY_KEY.get(key);
    if (!item || item.cat !== cat || !st.owned.includes(key)) return { ok: false, message: "Você ainda não tem este item." };
  }
  const equipped = { ...st.equipped };
  if (key) equipped[cat] = key; else delete equipped[cat];
  if (cat === "banner") {
    await db.update(users).set({ banner: key }).where(eq(users.id, me.id));
    revalidatePath("/", "layout");
    return { ok: true, message: key ? "Aplicado!" : "Removido.", state: await shopState(me.id, me.shownRoles) };
  }
  delete equipped.banner;
  await logAudit(db, { userId: me.id, entity: "shop", action: key ? "vestiu item da loja" : "tirou item da loja", field: SHOP_BY_KEY.get(key ?? "")?.name ?? cat });
  await db.insert(chatStyles).values({ userId: me.id, equipped }).onConflictDoUpdate({ target: chatStyles.userId, set: { equipped } });
  return { ok: true, message: key ? "Aplicado!" : "Removido.", state: await shopState(me.id, me.shownRoles) };
}


/** Compra o conjunto inteiro (25% mais barato; só se pagam as peças que faltam) e já veste tudo. */
export async function buySetAction(setKey: string): Promise<R> {
  const me = await requireUser();
  const set = SET_BY_KEY.get(setKey);
  if (!set) return { ok: false, message: "Conjunto não encontrado." };
  const [[who], settings] = await Promise.all([db.select({ b: users.coinsSpendBlocked }).from(users).where(eq(users.id, me.id)), getSettings()]);
  if (who?.b || settings.coins_spend_on !== 1) return { ok: false, message: "Os gastos de moedas estão bloqueados pelo Adm.", state: await shopState(me.id, me.shownRoles) };
  await shopState(me.id, me.shownRoles);
  const res = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${me.id}::bigint + 7000000)`);
    const have = (await tx.select({ k: shopPurchases.itemKey }).from(shopPurchases).where(eq(shopPurchases.userId, me.id))).map((r) => r.k);
    const missing = set.items.filter((k) => !have.includes(k));
    if (missing.length) {
      const price = setPrice(set, have);
      const [b] = await tx.select({ n: sql<number>`coalesce(sum(${coinLedger.amount}), 0)::int` }).from(coinLedger).where(eq(coinLedger.userId, me.id));
      if ((b?.n ?? 0) < price) return { ok: false as const, message: `Faltam ${price - (b?.n ?? 0)} moedas.` };
      const full = missing.reduce((a, k) => a + (SHOP_BY_KEY.get(k)?.price ?? 0), 0) || 1;
      await tx.insert(shopPurchases).values(missing.map((k) => ({ userId: me.id, itemKey: k, price: Math.round(((SHOP_BY_KEY.get(k)?.price ?? 0) / full) * price) })));
      await tx.insert(coinLedger).values({ userId: me.id, amount: -price, reason: `Loja: conjunto ${set.name}`, ref: `buyset:${set.key}:${Date.now()}` });
      await logAudit(tx, { userId: me.id, entity: "shop", action: "comprou conjunto na loja", field: set.name, newValue: `${price} moedas (${Math.round(SET_DISCOUNT * 100)}% de desconto)` });
    }
    await wear(tx, me.id, [...set.items]);
    return { ok: true as const, message: `Conjunto ${set.name} aplicado no seu perfil!` };
  });
  if (res.ok) revalidatePath("/", "layout");
  return { ...res, state: await shopState(me.id, me.shownRoles) };
}

/** Veste de uma vez as cinco peças de um conjunto que já é seu. */
export async function equipSetAction(setKey: string): Promise<R> {
  const me = await requireUser();
  const set = SET_BY_KEY.get(setKey);
  const st = await shopState(me.id, me.shownRoles);
  if (!set || !set.items.every((k) => st.owned.includes(k))) return { ok: false, message: "Você ainda não tem todas as peças deste conjunto.", state: st };
  await db.transaction((tx) => wear(tx, me.id, [...set.items]));
  await logAudit(db, { userId: me.id, entity: "shop", action: "vestiu conjunto da loja", field: set.name });
  revalidatePath("/", "layout");
  return { ok: true, message: `Conjunto ${set.name} aplicado!`, state: await shopState(me.id, me.shownRoles) };
}
