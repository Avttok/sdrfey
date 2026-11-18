"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NAV } from "@/config/nav";
import { db, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { RESET_KEYS, type ResetKey } from "./user-prefs-spec";

const fail = (message: string): ActionResult => ({ ok: false, message });

/** O Adm define posição e ordem da barra de navegação de qualquer pessoa. */
export async function setUserNavAction(userId: number, input: { layout: "top" | "side"; order: string[] }): Promise<ActionResult> {
  const me = await requireAdmin();
  const [u] = await db.select({ name: users.name, navLayout: users.navLayout, navOrder: users.navOrder }).from(users).where(eq(users.id, userId));
  if (!u) return fail("Usuário não encontrado.");
  const known = new Set(NAV.map((i) => i.href));
  const order = [...new Set(input.order.filter((h) => known.has(h)))];
  const layout = input.layout === "side" ? "side" : "top";
  await db.transaction(async (tx) => {
    await tx.update(users).set({ navLayout: layout, navOrder: order }).where(eq(users.id, userId));
    await logAudit(tx, { userId: me.id, entity: "user", action: "alterou", field: "barra de navegação", oldValue: `${u.navLayout} · ${u.navOrder.join(",")}`, newValue: `${layout} · ${order.join(",")}`, meta: { usuario: u.name, pelaAdmin: true } });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Barra de ${u.name} salva.` };
}

const PATCH: Record<Exclude<ResetKey, "all">, Partial<typeof users.$inferInsert>> = {
  accent: { accent: null },
  nav: { navLayout: "top", navOrder: [], navCollapsed: false },
  map: { mapMode: "map" },
  font: { font: "archivo" },
  goalsSdr: { dailyGoal: null, dailyGoalScheduled: null, goalAttendedOn: null, goalScheduledOn: null, goalsExtra: {} },
  goalsSeller: { sellerGoals: {} },
  goalsAccess: { canManageGoals: false },
  permissions: { permissions: {} },
  inMetrics: { inMetrics: true },
  manager: { managerId: null },
  lock: { failedAttempts: 0, lockedUntil: null },
};

/** Volta ao padrão qualquer parâmetro de uma pessoa (um, vários ou todos). Não mexe em nome, usuário, senha, cargos nem acesso. */
export async function resetUserSettingsAction(userId: number, keys: ResetKey[]): Promise<ActionResult> {
  const me = await requireAdmin();
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return fail("Usuário não encontrado.");
  const list = keys.includes("all") ? (Object.keys(PATCH) as Exclude<ResetKey, "all">[]) : [...new Set(keys)].filter((k): k is Exclude<ResetKey, "all"> => k in PATCH);
  if (!list.length) return fail("Escolha o que restaurar.");
  const patch = Object.assign({}, ...list.map((k) => PATCH[k])) as Partial<typeof users.$inferInsert>;
  await db.transaction(async (tx) => {
    await tx.update(users).set(patch).where(eq(users.id, userId));
    await logAudit(tx, { userId: me.id, entity: "user", action: "restaurou configurações", field: list.map((k) => RESET_KEYS.find((r) => r.key === k)?.label ?? k).join(", "), meta: { usuario: u.name, chaves: list } });
  });
  for (const p of ["/", "/metas", "/painel", "/atender"]) revalidatePath(p, p === "/" ? "layout" : undefined);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: `${u.name}: ${list.length === 1 ? "configuração restaurada" : `${list.length} configurações restauradas`} ao padrão.` };
}
