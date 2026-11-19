"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { achievementOverrides, db, users } from "@/db";
import { ACHIEVEMENT_BY_KEY } from "@/config/achievements";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin, requireUser } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { achievementsOf } from "./stats";

/** Resumo para o menu da foto: quantas a pessoa tem e as mais valiosas (as de meta mais alta). */
export async function badgesSummaryAction(): Promise<{ earned: number; total: number; top: { key: string; name: string }[] }> {
  const me = await requireUser();
  const { list } = await achievementsOf(me.id, me.roles);
  const got = list.filter((a) => a.earned).sort((a, b) => b.goal - a.goal || a.key.localeCompare(b.key));
  return { earned: got.length, total: list.length, top: got.slice(0, 5).map((a) => ({ key: a.key, name: a.name })) };
}

/** O Adm dá, bloqueia ou devolve ao automático uma conquista de qualquer pessoa. */
export async function setAchievementAction(userId: number, key: string, state: "granted" | "blocked" | "auto"): Promise<ActionResult> {
  const me = await requireAdmin();
  const a = ACHIEVEMENT_BY_KEY.get(key);
  if (!a) return { ok: false, message: "Conquista não encontrada." };
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return { ok: false, message: "Pessoa não encontrada." };
  if (state === "auto") await db.delete(achievementOverrides).where(and(eq(achievementOverrides.userId, userId), eq(achievementOverrides.key, key)));
  else await db.insert(achievementOverrides).values({ userId, key, granted: state === "granted", by: me.id }).onConflictDoUpdate({ target: [achievementOverrides.userId, achievementOverrides.key], set: { granted: state === "granted", by: me.id, at: new Date() } });
  await logAudit(db, { userId: me.id, entity: "user", action: state === "granted" ? "deu uma conquista" : state === "blocked" ? "bloqueou uma conquista" : "devolveu uma conquista ao automático", field: a.name, newValue: u.name });
  revalidatePath("/conquistas");
  return { ok: true, message: state === "granted" ? "Conquista liberada." : state === "blocked" ? "Conquista bloqueada." : "Volta a valer a estatística." };
}
