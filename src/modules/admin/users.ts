"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAccentKey } from "@/config/theme";
import { PERMISSION_KEYS } from "@/config/permissions";
import { ROLES, type Role } from "@/config/roles";
import { db, users } from "@/db";
import { diffToAudit, logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { hashPassword } from "@/modules/auth/password";
import type { ActionResult } from "@/modules/leads/actions";

const initialPassword = () => process.env.SEED_INITIAL_PASSWORD || "12345";
const fail = (message: string): ActionResult => ({ ok: false, message });

const roleList = z.array(z.enum(ROLES)).min(1, "Escolha ao menos um cargo.");

async function otherActiveAdmins(exceptId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(ne(users.id, exceptId), eq(users.active, true), sql`'admin' = any(${users.roles})`));
  return r?.n ?? 0;
}

export async function createUserAction(input: { username: string; name: string; roles: Role[] }): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, "Usuário: 3 a 40 letras minúsculas, números, ponto, hífen ou _."), name: z.string().trim().min(2, "Informe o nome."), roles: roleList }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.username, p.data.username));
  if (dup) return fail("Já existe um usuário com esse login.");
  const [u] = await db.insert(users).values({ username: p.data.username, name: p.data.name, roles: p.data.roles, passwordHash: await hashPassword(initialPassword()), mustChangePassword: true }).returning({ id: users.id });
  await logAudit(db, { userId: me.id, entity: "user", action: "criou usuário", field: "Usuário", newValue: p.data.username, meta: { id: u.id, cargos: p.data.roles } });
  revalidatePath("/admin/usuarios");
  return { ok: true, message: `Usuário criado. Senha inicial: ${initialPassword()} (será trocada no primeiro acesso).` };
}

export type UserPatch = { name: string; roles: Role[]; active: boolean; dailyGoal: number | null; canManageGoals: boolean; inMetrics: boolean; permissions: Record<string, boolean>; accent?: string | null };

export async function updateUserAction(id: number, input: UserPatch): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({
    name: z.string().trim().min(2, "Informe o nome."), roles: roleList, active: z.boolean(),
    dailyGoal: z.number().int().min(0).max(1000).nullable(), canManageGoals: z.boolean(), inMetrics: z.boolean(),
    permissions: z.record(z.string(), z.boolean()), accent: z.string().nullable().optional(),
  }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [before] = await db.select().from(users).where(eq(users.id, id));
  if (!before) return fail("Usuário não encontrado.");

  const loses = before.roles.includes("admin") && (!p.data.roles.includes("admin") || !p.data.active);
  if (loses && (await otherActiveAdmins(id)) === 0) return fail("Este é o último Adm ativo: ele não pode perder o cargo nem ser bloqueado.");
  if (id === me.id && !p.data.active) return fail("Você não pode bloquear a si mesmo.");

  if (p.data.accent && !isAccentKey(p.data.accent)) return fail("Cor inválida.");
  const accent = p.data.accent === undefined ? before.accent : p.data.accent || null;
  const permissions = Object.fromEntries(Object.entries(p.data.permissions).filter(([k]) => PERMISSION_KEYS.includes(k)));
  const next = { name: p.data.name, roles: p.data.roles, active: p.data.active, dailyGoal: p.data.dailyGoal, canManageGoals: p.data.canManageGoals, inMetrics: p.data.inMetrics, permissions, accent };
  const kill = before.active !== next.active || before.roles.join() !== next.roles.join();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ ...next, ...(kill ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}) }).where(eq(users.id, id));
    await logAudit(tx, diffToAudit({ userId: me.id, entity: "user", meta: { usuario: before.username } }, { name: before.name, roles: before.roles, active: before.active, dailyGoal: before.dailyGoal, canManageGoals: before.canManageGoals, inMetrics: before.inMetrics, permissions: JSON.stringify(before.permissions), accent: before.accent } as Record<string, unknown>, { ...next, permissions: JSON.stringify(permissions) } as Record<string, unknown>, { name: "Nome", roles: "Cargos", active: "Ativo", dailyGoal: "Meta diária", canManageGoals: "Pode gerenciar metas", inMetrics: "Aparece nas métricas", permissions: "Permissões individuais", accent: "Cor" }));
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Usuário salvo." };
}

export async function resetPasswordAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return fail("Usuário não encontrado.");
  await db.update(users).set({ passwordHash: await hashPassword(initialPassword()), mustChangePassword: true, failedAttempts: 0, lockedUntil: null, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  await logAudit(db, { userId: me.id, entity: "user", action: "redefiniu a senha", field: "Senha", meta: { usuario: u.username } });
  return { ok: true, message: `Senha de ${u.name} redefinida para a inicial (${initialPassword()}); ele troca no próximo acesso.` };
}

/**
 * Exclui TOTALMENTE o usuário (a confirmação é pedida na tela). O histórico de leads e interações é mantido,
 * sem nome ("Sistema"); as sessões de atendimento e a presença dele são apagadas junto.
 */
export async function deleteUserAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return fail("Usuário não encontrado.");
  if (id === me.id) return fail("Você não pode excluir a si mesmo.");
  if (u.roles.includes("admin") && (await otherActiveAdmins(id)) === 0) return fail("Este é o último Adm ativo.");
  await db.transaction(async (tx) => {
    await logAudit(tx, { userId: me.id, entity: "user", action: "excluiu usuário", field: "Usuário", oldValue: `${u.name} (@${u.username})`, newValue: null, meta: { usuario: u.username, cargos: u.roles } });
    await tx.delete(users).where(eq(users.id, id));
  });
  revalidatePath("/admin/usuarios");
  return { ok: true, message: `${u.name} foi excluído por completo.` };
}

/** Faz a tela de personalização do perfil (primeiro acesso, sem trocar a senha) aparecer de novo: para uma pessoa ou para todas. */
export async function triggerProfileScreenAction(target: number | "all"): Promise<ActionResult> {
  const me = await requireAdmin();
  if (target === "all") {
    const r = await db.update(users).set({ profileDone: false }).where(eq(users.active, true)).returning({ id: users.id });
    await logAudit(db, { userId: me.id, entity: "user", action: "pediu a personalização do perfil", field: "Primeiro acesso", meta: { alvo: "todos", pessoas: r.length } });
    revalidatePath("/", "layout");
    return { ok: true, message: `Todos (${r.length}) verão a tela de personalização no próximo acesso.` };
  }
  const [u] = await db.select().from(users).where(eq(users.id, target));
  if (!u) return fail("Usuário não encontrado.");
  await db.update(users).set({ profileDone: false }).where(eq(users.id, target));
  await logAudit(db, { userId: me.id, entity: "user", action: "pediu a personalização do perfil", field: "Primeiro acesso", meta: { usuario: u.username } });
  revalidatePath("/", "layout");
  return { ok: true, message: `${u.name} verá a tela de personalização no próximo acesso.` };
}
