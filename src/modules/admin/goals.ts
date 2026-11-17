"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, settings, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { getSettings } from "@/modules/settings/get";

export type GoalInput = { on: boolean; qty: number };
export type PersonGoalInput = { on: boolean | null; qty: number | null };
export type GoalsInput = {
  global: { attended: GoalInput; scheduled: GoalInput };
  perUser: Record<number, { attended: PersonGoalInput; scheduled: PersonGoalInput }>;
};

/** Metas (atendidos e agendados): globais e individuais. Só quem tem a permissão "goals.edit" (Adm sempre) altera. */
export async function saveGoalsAction(input: GoalsInput): Promise<ActionResult> {
  const me = await requirePerm("goals.edit");
  const num = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 1000);
  const g = input.global;
  if (!num(g.attended.qty) || !num(g.scheduled.qty) || !Object.values(input.perUser).every((p) => num(p.attended.qty) && num(p.scheduled.qty))) {
    return { ok: false, message: "As metas precisam ser números inteiros de 0 a 1000." };
  }
  const before = await getSettings();
  const setKey = async (key: string, label: string, old: number, val: number) => {
    if (old === val) return;
    await db.insert(settings).values({ key, value: val, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: val, updatedAt: new Date(), updatedBy: me.id } });
    await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta global", field: label, oldValue: old, newValue: val });
  };
  await setKey("daily_goal", "Meta de atendidos (quantidade)", before.daily_goal, g.attended.qty);
  await setKey("goal_attended_on", "Meta de atendidos (ativa)", before.goal_attended_on, g.attended.on ? 1 : 0);
  await setKey("daily_goal_scheduled", "Meta de agendados (quantidade)", before.daily_goal_scheduled, g.scheduled.qty);
  await setKey("goal_scheduled_on", "Meta de agendados (ativa)", before.goal_scheduled_on, g.scheduled.on ? 1 : 0);

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

export type SellerGoalsInput = { global: { contacts: number; sales: number }; perUser: Record<number, { contacts: number | null; sales: number | null }> };

/** Metas dos vendedores: contatos por dia e vendas por mês, globais e individuais. */
export async function saveSellerGoalsAction(input: SellerGoalsInput): Promise<ActionResult> {
  const me = await requirePerm("goals.edit");
  const ok = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 1000);
  if (!ok(input.global.contacts) || !ok(input.global.sales) || !Object.values(input.perUser).every((p) => ok(p.contacts) && ok(p.sales))) return { ok: false, message: "As metas precisam ser números inteiros de 0 a 1000." };
  const before = await getSettings();
  const setKey = async (key: string, label: string, old: number, val: number) => {
    if (old === val) return;
    await db.insert(settings).values({ key, value: val, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: val, updatedAt: new Date(), updatedBy: me.id } });
    await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta global", field: label, oldValue: old, newValue: val });
  };
  await setKey("seller_goal_contacts", "Meta de vendedor: contatos por dia", before.seller_goal_contacts, input.global.contacts);
  await setKey("seller_goal_sales", "Meta de vendedor: vendas por mês", before.seller_goal_sales, input.global.sales);
  for (const [idStr, p] of Object.entries(input.perUser)) {
    const [u] = await db.select().from(users).where(eq(users.id, Number(idStr)));
    if (!u) continue;
    const labels: [boolean, string, number | null, number | null][] = [[u.sellerGoalContacts !== p.contacts, "Contatos por dia", u.sellerGoalContacts, p.contacts], [u.sellerGoalSales !== p.sales, "Vendas por mês", u.sellerGoalSales, p.sales]];
    if (!labels.some(([c]) => c)) continue;
    await db.update(users).set({ sellerGoalContacts: p.contacts, sellerGoalSales: p.sales }).where(eq(users.id, u.id));
    for (const [changed, label, o, n] of labels) if (changed) await logAudit(db, { userId: me.id, entity: "goal", action: "alterou meta individual", field: `${u.name} · ${label}`, oldValue: o, newValue: n });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Metas de vendas salvas." };
}
