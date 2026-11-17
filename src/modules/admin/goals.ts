"use server";

import { invalidateSettings } from "@/modules/settings/get";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, settings, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";
import { goalScope } from "@/modules/auth/goal-scope";
import type { ActionResult } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";
import { SELLER_METRICS } from "@/config/seller-goals";

/** Quem tem "goals.edit" (tudo) ou "goals.edit.own" (só a própria meta). */
async function requireGoalEditor() {
  const me = await requireUser();
  if (!goalScope(me.permissions)) throw new Error("Sem permissão para alterar metas.");
  return me;
}

export type GoalInput = { on: boolean; qty: number };
export type PersonGoalInput = { on: boolean | null; qty: number | null };
export type GoalsInput = {
  global: { attended: GoalInput; scheduled: GoalInput };
  perUser: Record<number, { attended: PersonGoalInput; scheduled: PersonGoalInput }>;
};

/** Metas (atendidos e agendados): globais e individuais. Só quem tem a permissão "goals.edit" (Adm sempre) altera. */
export async function saveGoalsAction(input: GoalsInput): Promise<ActionResult> {
  const me = await requireGoalEditor();
  const scope = goalScope(me.permissions)!;
  const num = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 1000);
  const g = input.global;
  if (!num(g.attended.qty) || !num(g.scheduled.qty) || !Object.values(input.perUser).every((p) => num(p.attended.qty) && num(p.scheduled.qty))) {
    return { ok: false, message: "As metas precisam ser números inteiros de 0 a 1000." };
  }
  const before = await getSettings();
  if (scope === "own") input = { ...input, perUser: Object.fromEntries(Object.entries(input.perUser).filter(([id]) => Number(id) === me.id)) };
  const setKey = async (key: string, label: string, old: number, val: number) => {
    if (old === val) return;
    await db.insert(settings).values({ key, value: val, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: val, updatedAt: new Date(), updatedBy: me.id } });
    invalidateSettings();
    await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta global", field: label, oldValue: old, newValue: val });
  };
  if (scope === "all") {
  await setKey("daily_goal", "Meta de atendidos (quantidade)", before.daily_goal, g.attended.qty);
  await setKey("goal_attended_on", "Meta de atendidos (ativa)", before.goal_attended_on, g.attended.on ? 1 : 0);
  await setKey("daily_goal_scheduled", "Meta de agendados (quantidade)", before.daily_goal_scheduled, g.scheduled.qty);
  await setKey("goal_scheduled_on", "Meta de agendados (ativa)", before.goal_scheduled_on, g.scheduled.on ? 1 : 0);
  }

  for (const [idStr, p] of Object.entries(input.perUser)) {
    const [u] = await db.select().from(users).where(eq(users.id, Number(idStr)));
    if (!u) continue;
    const next = { dailyGoal: p.attended.qty, goalAttendedOn: p.attended.on, dailyGoalScheduled: p.scheduled.qty, goalScheduledOn: p.scheduled.on };
    const labels: [keyof typeof next, string][] = [["dailyGoal", "Meta de atendidos"], ["goalAttendedOn", "Meta de atendidos (ativa)"], ["dailyGoalScheduled", "Meta de agendados"], ["goalScheduledOn", "Meta de agendados (ativa)"]];
    const changes = labels.filter(([k]) => u[k] !== next[k]);
    if (!changes.length) continue;
    await db.update(users).set(next).where(eq(users.id, u.id));
    for (const [k, label] of changes) await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta individual", field: `${u.name} · ${label}`, oldValue: u[k] as never, newValue: next[k] as never });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Metas salvas." };
}

export type SellerGoalsInput = { global: Record<string, number>; perUser: Record<number, Record<string, number>> };

/** Metas dos vendedores: meta e peso globais (padrão do time) e metas próprias por vendedor. */
export async function saveSellerGoalsAction(input: SellerGoalsInput): Promise<ActionResult> {
  const me = await requireGoalEditor();
  const scope = goalScope(me.permissions)!;
  if (scope === "own") input = { global: input.global, perUser: Object.fromEntries(Object.entries(input.perUser).filter(([id]) => Number(id) === me.id)) };
  const keys = SELLER_METRICS.map((m) => m.key as string);
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100_000_000;
  const g: Record<string, number> = {};
  for (const m of SELLER_METRICS) {
    const t = input.global[m.key], w = input.global[`w_${m.key}`];
    if (!num(t) || !num(w) || w > 100) return { ok: false, message: "Metas precisam ser números (≥ 0) e pesos de 0 a 100." };
    g[m.key] = t; g[`w_${m.key}`] = w;
  }
  if (scope === "all" && SELLER_METRICS.reduce((a, m) => a + g[`w_${m.key}`], 0) !== 100) return { ok: false, message: "Os pesos precisam somar 100%." };
  const [row] = await db.select().from(settings).where(eq(settings.key, "seller_goals"));
  const before = (row?.value ?? {}) as Record<string, number>;
  const label = (k: string) => { const m = SELLER_METRICS.find((x) => x.key === k.replace(/^w_/, ""))!; return k.startsWith("w_") ? `Peso de ${m.label}` : `Meta de ${m.label}`; };
  await db.transaction(async (tx) => {
    if (scope === "all") for (const k of Object.keys(g)) {
      const old = before[k] ?? (k.startsWith("w_") ? SELLER_METRICS.find((m) => m.key === k.slice(2))!.weight : SELLER_METRICS.find((m) => m.key === k)!.target);
      if (old !== g[k]) await logAudit(tx, { userId: me.id, entity: "goal", action: "alterou meta de vendedor (global)", field: label(k), oldValue: old, newValue: g[k] });
    }
    if (scope === "all") await tx.insert(settings).values({ key: "seller_goals", value: g, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: g, updatedAt: new Date(), updatedBy: me.id } });
    for (const [idStr, own] of Object.entries(input.perUser)) {
      const [u] = await tx.select().from(users).where(eq(users.id, Number(idStr)));
      if (!u) continue;
      const clean = Object.fromEntries(Object.entries(own).filter(([k, v]) => keys.includes(k) && num(v)));
      if (JSON.stringify(u.sellerGoals ?? {}) === JSON.stringify(clean)) continue;
      await tx.update(users).set({ sellerGoals: clean }).where(eq(users.id, u.id));
      await logAudit(tx, { userId: me.id, entity: "goal", action: "alterou meta individual", field: `${u.name} · Metas de vendedor`, oldValue: JSON.stringify(u.sellerGoals ?? {}), newValue: JSON.stringify(clean) });
    }
  });
  invalidateSettings();
  revalidatePath("/", "layout");
  return { ok: true, message: "Metas de vendas salvas." };
}
