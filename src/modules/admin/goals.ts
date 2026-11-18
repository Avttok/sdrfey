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
import { SDR_KINDS, type GoalKind } from "@/modules/settings/goals";

/** Quem tem "goals.edit" (tudo) ou "goals.edit.own" (só a própria meta). */
async function requireGoalEditor() {
  const me = await requireUser();
  if (!goalScope(me.permissions)) throw new Error("Sem permissão para alterar metas.");
  return me;
}

export type GoalInput = { on: boolean; qty: number };
export type PersonGoalInput = { on: boolean | null; qty: number | null };
export type PersonGoalsInput = { goals: Record<GoalKind, PersonGoalInput>; /** desliga todas as metas desta pessoa */ off: boolean };
export type GoalsInput = { global: Record<GoalKind, GoalInput>; perUser: Record<number, PersonGoalsInput> };

/** Metas do SDR (atendidos, agendados, ligações, convertidos): globais e individuais, cada uma com liga/desliga. */
export async function saveGoalsAction(input: GoalsInput): Promise<ActionResult> {
  const me = await requireGoalEditor();
  const scope = goalScope(me.permissions)!;
  const num = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 1000);
  if (!SDR_KINDS.every((d) => num(input.global[d.k]?.qty)) || !Object.values(input.perUser).every((p) => SDR_KINDS.every((d) => num(p.goals[d.k]?.qty)))) {
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
  if (scope === "all") for (const d of SDR_KINDS) {
    await setKey(d.qty, `${d.title} (quantidade)`, before[d.qty], input.global[d.k].qty);
    await setKey(d.on, `${d.title} (ativa)`, before[d.on], input.global[d.k].on ? 1 : 0);
  }

  for (const [idStr, p] of Object.entries(input.perUser)) {
    const [u] = await db.select().from(users).where(eq(users.id, Number(idStr)));
    if (!u) continue;
    const extra: Record<string, number> = { ...(u.goalsExtra ?? {}) };
    const put = (key: string, v: number | null) => { if (v === null) delete extra[key]; else extra[key] = v; };
    put("calls", p.goals.calls.qty); put("calls_on", p.goals.calls.on === null ? null : p.goals.calls.on ? 1 : 0);
    put("converted", p.goals.converted.qty); put("converted_on", p.goals.converted.on === null ? null : p.goals.converted.on ? 1 : 0);
    put("off_all", p.off ? 1 : null);
    const next = { dailyGoal: p.goals.attended.qty, goalAttendedOn: p.goals.attended.on, dailyGoalScheduled: p.goals.scheduled.qty, goalScheduledOn: p.goals.scheduled.on, goalsExtra: extra };
    const changes: [string, unknown, unknown][] = [];
    if (u.dailyGoal !== next.dailyGoal) changes.push(["Meta de atendidos", u.dailyGoal, next.dailyGoal]);
    if (u.goalAttendedOn !== next.goalAttendedOn) changes.push(["Meta de atendidos (ativa)", u.goalAttendedOn, next.goalAttendedOn]);
    if (u.dailyGoalScheduled !== next.dailyGoalScheduled) changes.push(["Meta de agendados", u.dailyGoalScheduled, next.dailyGoalScheduled]);
    if (u.goalScheduledOn !== next.goalScheduledOn) changes.push(["Meta de agendados (ativa)", u.goalScheduledOn, next.goalScheduledOn]);
    const labels: Record<string, string> = { calls: "Meta de ligações", calls_on: "Meta de ligações (ativa)", converted: "Meta de convertidos", converted_on: "Meta de convertidos (ativa)", off_all: "Todas as metas desligadas" };
    for (const k of Object.keys(labels)) if ((u.goalsExtra ?? {})[k] !== extra[k]) changes.push([labels[k], (u.goalsExtra ?? {})[k] ?? null, extra[k] ?? null]);
    if (!changes.length) continue;
    await db.update(users).set(next).where(eq(users.id, u.id));
    for (const [label, o, n] of changes) await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta individual", field: `${u.name} · ${label}`, oldValue: o as never, newValue: n as never });
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
  const keys = [...SELLER_METRICS.map((m) => m.key as string), ...SELLER_METRICS.map((m) => `off_${m.key}`), "off_all"];
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100_000_000;
  const g: Record<string, number> = {};
  for (const m of SELLER_METRICS) {
    const t = input.global[m.key], w = input.global[`w_${m.key}`];
    if (!num(t) || !num(w) || w > 100) return { ok: false, message: "Metas precisam ser números (≥ 0) e pesos de 0 a 100." };
    g[m.key] = t; g[`w_${m.key}`] = w;
    g[`off_${m.key}`] = input.global[`off_${m.key}`] === 1 ? 1 : 0;
  }
  const active = SELLER_METRICS.filter((m) => g[`off_${m.key}`] !== 1);
  if (scope === "all" && active.length > 0 && active.reduce((a, m) => a + g[`w_${m.key}`], 0) !== 100) return { ok: false, message: "Os pesos precisam somar 100%." };
  const [row] = await db.select().from(settings).where(eq(settings.key, "seller_goals"));
  const before = (row?.value ?? {}) as Record<string, number>;
  const label = (k: string) => { const m = SELLER_METRICS.find((x) => x.key === k.replace(/^(w|off)_/, ""))!; return k.startsWith("w_") ? `Peso de ${m.label}` : k.startsWith("off_") ? `${m.label} (desligada)` : `Meta de ${m.label}`; };
  await db.transaction(async (tx) => {
    if (scope === "all") for (const k of Object.keys(g)) {
      const old = before[k] ?? (k.startsWith("off_") ? 0 : k.startsWith("w_") ? SELLER_METRICS.find((m) => m.key === k.slice(2))!.weight : SELLER_METRICS.find((m) => m.key === k)!.target);
      if (old !== g[k]) await logAudit(tx, { userId: me.id, entity: "goal", action: "alterou meta de vendedor (global)", field: label(k), oldValue: old, newValue: g[k] });
    }
    if (scope === "all") await tx.insert(settings).values({ key: "seller_goals", value: g, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: g, updatedAt: new Date(), updatedBy: me.id } });
    for (const [idStr, own] of Object.entries(input.perUser)) {
      const [u] = await tx.select().from(users).where(eq(users.id, Number(idStr)));
      if (!u) continue;
      const clean = Object.fromEntries(Object.entries(own).filter(([k, v]) => keys.includes(k) && num(v) && (!k.startsWith("off_") || v === 0 || v === 1)));
      if (JSON.stringify(u.sellerGoals ?? {}) === JSON.stringify(clean)) continue;
      await tx.update(users).set({ sellerGoals: clean }).where(eq(users.id, u.id));
      await logAudit(tx, { userId: me.id, entity: "goal", action: "alterou meta individual", field: `${u.name} · Metas de vendedor`, oldValue: JSON.stringify(u.sellerGoals ?? {}), newValue: JSON.stringify(clean) });
    }
  });
  invalidateSettings();
  revalidatePath("/", "layout");
  return { ok: true, message: "Metas de vendas salvas." };
}
