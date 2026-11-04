"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, settings, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";

/** Metas: global e individuais. Só quem tem a permissão "goals.edit" (Adm sempre) altera. */
export async function saveGoalsAction(input: { global: number; perUser: Record<number, number | null> }): Promise<ActionResult> {
  const me = await requirePerm("goals.edit");
  const ok = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 1000);
  if (!ok(input.global) || input.global === null || !Object.values(input.perUser).every(ok)) return { ok: false, message: "As metas precisam ser números inteiros de 0 a 1000." };
  const before = await getSettings();
  if (before.daily_goal !== input.global) {
    await db.insert(settings).values({ key: "daily_goal", value: input.global, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: input.global, updatedAt: new Date(), updatedBy: me.id } });
    await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta global", field: "Meta diária", oldValue: before.daily_goal, newValue: input.global });
  }
  for (const [idStr, goal] of Object.entries(input.perUser)) {
    const id = Number(idStr);
    const [u] = await db.select({ name: users.name, dailyGoal: users.dailyGoal }).from(users).where(eq(users.id, id));
    if (!u || u.dailyGoal === goal) continue;
    await db.update(users).set({ dailyGoal: goal }).where(eq(users.id, id));
    await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta individual", field: `${u.name} · Meta diária`, oldValue: u.dailyGoal, newValue: goal });
  }
  revalidatePath("/metas");
  return { ok: true, message: "Metas salvas." };
}
