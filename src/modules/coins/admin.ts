"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { coinLedger, db, settings, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";

const fail = (message: string): ActionResult => ({ ok: false, message });
const balanceOf = async (uid: number) => (await db.select({ n: sql<number>`coalesce(sum(${coinLedger.amount}), 0)::int` }).from(coinLedger).where(eq(coinLedger.userId, uid)))[0]?.n ?? 0;

/** Soma ou tira moedas (delta) ou define o saldo exato (to). Fica no extrato com o motivo. */
export async function adjustCoinsAction(userId: number, input: { mode: "add" | "set"; value: number; reason: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const v = Math.trunc(Number(input.value));
  if (!Number.isFinite(v) || Math.abs(v) > 1_000_000) return fail("Valor inválido.");
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return fail("Pessoa não encontrada.");
  const before = await balanceOf(userId);
  const delta = input.mode === "set" ? v - before : v;
  if (delta === 0) return fail("Nada a mudar.");
  const why = input.reason.trim().slice(0, 120);
  await db.insert(coinLedger).values({ userId, amount: delta, reason: `Ajuste do Adm${why ? `: ${why}` : ""}`, ref: `adm:${Date.now()}:${Math.random().toString(36).slice(2, 7)}` });
  await logAudit(db, { userId: me.id, entity: "user", action: "ajustou moedas", field: u.name, oldValue: String(before), newValue: String(before + delta) });
  revalidatePath("/admin/moedas");
  return { ok: true, message: `${u.name}: ${before} → ${before + delta} moedas.` };
}

export async function setCoinsBlockAction(userId: number, kind: "earn" | "spend", blocked: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return fail("Pessoa não encontrada.");
  await db.update(users).set(kind === "earn" ? { coinsEarnBlocked: blocked } : { coinsSpendBlocked: blocked }).where(eq(users.id, userId));
  await logAudit(db, { userId: me.id, entity: "user", action: `${blocked ? "bloqueou" : "liberou"} ${kind === "earn" ? "ganho" : "gasto"} de moedas`, field: u.name });
  revalidatePath("/admin/moedas");
  return { ok: true, message: `${kind === "earn" ? "Ganho" : "Gasto"} de ${u.name} ${blocked ? "bloqueado" : "liberado"}.` };
}

export async function setCoinsGlobalAction(kind: "earn" | "spend", on: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  const key = kind === "earn" ? "coins_earn_on" : "coins_spend_on";
  await db.insert(settings).values({ key, value: on ? 1 : 0, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: on ? 1 : 0, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: `${on ? "ligou" : "desligou"} ${kind === "earn" ? "o ganho" : "o gasto"} de moedas para todos` });
  revalidatePath("/admin/moedas");
  return { ok: true, message: `${kind === "earn" ? "Ganho" : "Gasto"} de moedas ${on ? "ligado" : "desligado"} para todos.` };
}

export async function coinHistoryAction(userId: number): Promise<{ id: number; amount: number; reason: string; at: string }[]> {
  await requireAdmin();
  const rows = await db.select().from(coinLedger).where(and(eq(coinLedger.userId, userId), sql`${coinLedger.amount} <> 0`)).orderBy(desc(coinLedger.id)).limit(30);
  return rows.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, at: r.createdAt.toISOString() }));
}
