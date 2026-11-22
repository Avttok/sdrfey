import { cleanTree, type NavTree } from "@/config/nav-tree";
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

export const ADMIN_VIEW_COOKIE = "admin_view";

export type CurrentUser = {
  id: number;
  username: string;
  name: string;
  /** Cargos que valem agora para a tela (no modo "ver como usuário", só os cargos reais, sem o Adm). */
  roles: Role[];
  /** É Adm de verdade: os privilégios de Adm valem sempre, mesmo vendo a tela como usuário comum. */
  isAdmin: boolean;
  /** Só para o Adm: "all" = vê tudo como Adm; "me" = vê só o que um usuário comum com os mesmos cargos veria. */
  adminView: "all" | "me";
  /** Cargos que a pessoa de fato tem (sem o Adm, que não precisa de etiqueta): para exibir etiquetas e cores. */
  shownRoles: Role[];
  accent: string | null;
  avatar: string | null;
  banner: string | null;
  profileDone: boolean;
  navLayout: "top" | "side";
  navOrder: string[];
  navCustom: NavCustom;
  /** Estrutura de pastas definida pelo Adm (para todos ou só para esta pessoa). Nulo = pastas padrão. */
  navTree: NavTree | null;
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

  const isAdmin = u.roles.includes("admin");
  const adminView: "all" | "me" = isAdmin && (await cookies()).get(ADMIN_VIEW_COOKIE)?.value === "me" ? "me" : "all";
  const real = u.roles.filter((r) => r !== "admin");
  const asUser: Role[] = real.length ? real : ["user"];
  const permissions = resolvePermissions(adminView === "me" ? asUser : u.roles, u.permissions, ((await settingValue("role_permissions")) ?? {}) as RoleOverrides);
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
    // O Adm age como todos os cargos: nenhuma regra de cargo (shufflers, negociações, painéis) o limita.
    roles: adminView === "me" ? asUser : isAdmin ? (["user", "seller", "manager", "admin"] as Role[]) : u.roles,
    isAdmin,
    adminView,
    shownRoles: u.roles.filter((r) => r !== "admin").length ? u.roles.filter((r) => r !== "admin") : u.roles,
    accent: u.accent,
    avatar: u.avatar ?? null,
    banner: u.banner ?? null,
    profileDone: u.profileDone,
    navLayout: u.navLayout === "side" ? "side" : "top",
    /* a ordem é só do Adm (global); a ordem pessoal antiga é ignorada */
    navOrder: ((await settingValue("nav_order")) as string[] | undefined) ?? [],
    navCustom: mergeCustom(cleanCustom(await settingValue("nav_custom")), cleanCustom(await settingValue(`nav_custom_u${u.id}`))),
    navTree: cleanTree(await settingValue(`nav_tree_u${u.id}`)) ?? cleanTree(await settingValue("nav_tree")),
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
  if ((user.mustChangePassword || !user.profileDone) && !opts.allowMustChange) redirect("/primeiro-acesso");
  return user;
}

/** Igual a requireUser, mas exige um cargo mínimo. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin && !hasRole(user.roles, role)) redirect("/painel");
  return user;
}

/** Exige uma permissão (o Adm sempre passa). Quem não tem volta para a primeira página que pode ver. */
export async function requirePerm(key: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin && !user.permissions[key]) redirect("/conta");
  return user;
}

/** Área do Adm: só quem tem o cargo Adm. */
export async function requireAdmin(): Promise<CurrentUser> {
  return requireRole("admin");
}
