import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, users } from "@/db";
import { hasRole, type Role } from "@/config/roles";
import type { PermissionMap, RoleOverrides } from "@/config/permissions";
import { resolvePermissions } from "@/modules/permissions/resolve";
import { settingValue } from "@/modules/settings/get";
import { cleanCustom, mergeCustom, type NavCustom } from "@/config/nav-icons";
import { SESSION_COOKIE, readToken, sessionMaxAge, signToken } from "./token";

export type CurrentUser = {
  id: number;
  username: string;
  name: string;
  roles: Role[];
  accent: string | null;
  avatar: string | null;
  banner: string | null;
  profileDone: boolean;
  navLayout: "top" | "side";
  navOrder: string[];
  navCustom: NavCustom;
  navCollapsed: boolean;
  font: string;
  mapMode: "map" | "link";
  mustChangePassword: boolean;
  permissions: PermissionMap;
  canManageGoals: boolean;
  dailyGoal: number | null;
  dailyGoalScheduled: number | null;
  goalAttendedOn: boolean | null;
  goalScheduledOn: boolean | null;
  goalsExtra: Record<string, number>;
};

/** Grava o cookie de login. */
export async function setSessionCookie(userId: number, version: number, remember: boolean) {
  const token = await signToken({ uid: userId, v: version, rem: remember });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge(remember),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Quem está logado agora (ou null). Consulta o banco uma vez por requisição. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readToken(token) : null;
  if (!session) return null;

  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u || !u.active || u.sessionVersion !== session.v) return null;

  const permissions = resolvePermissions(u.roles, u.permissions, ((await settingValue("role_permissions")) ?? {}) as RoleOverrides);
  if (u.canManageGoals) permissions["goals.edit"] = true;

  return {
    permissions,
    canManageGoals: u.canManageGoals,
    dailyGoal: u.dailyGoal,
    dailyGoalScheduled: u.dailyGoalScheduled,
    goalAttendedOn: u.goalAttendedOn,
    goalScheduledOn: u.goalScheduledOn,
    goalsExtra: u.goalsExtra ?? {},
    id: u.id,
    username: u.username,
    name: u.name,
    roles: u.roles,
    accent: u.accent,
    avatar: u.avatar ?? null,
    banner: u.banner ?? null,
    profileDone: u.profileDone,
    navLayout: u.navLayout === "side" ? "side" : "top",
    navOrder: u.navOrder?.length ? u.navOrder : (((await settingValue("nav_order")) as string[] | undefined) ?? []),
    navCustom: mergeCustom(cleanCustom(await settingValue("nav_custom")), cleanCustom(await settingValue(`nav_custom_u${u.id}`))),
    navCollapsed: !!u.navCollapsed,
    font: u.font ?? "archivo",
    mapMode: u.mapMode === "link" ? "link" : "map",
    mustChangePassword: u.mustChangePassword,
  };
});

/** Use no topo de páginas e ações que exigem login. */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if ((user.mustChangePassword || !user.profileDone) && !opts.allowMustChange) redirect("/trocar-senha");
  return user;
}

/** Igual a requireUser, mas exige um cargo mínimo. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user.roles, role)) redirect("/painel");
  return user;
}

/** Exige uma permissão (o Adm sempre passa). Quem não tem volta para a primeira página que pode ver. */
export async function requirePerm(key: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions[key]) redirect("/conta");
  return user;
}

/** Área do Adm: só quem tem o cargo Adm. */
export async function requireAdmin(): Promise<CurrentUser> {
  return requireRole("admin");
}
