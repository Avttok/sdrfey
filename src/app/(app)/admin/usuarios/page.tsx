import { and, asc, eq, gt, sql } from "drizzle-orm";
import { Users } from "lucide-react";
import { TeamWorkspace } from "@/components/admin/team-workspace";
import type { UserRow } from "@/components/admin/user-card";
import { PageHead } from "@/components/page-head";
import { orderNav, visibleNav } from "@/config/nav";
import { PERMISSIONS, type PermissionMap, type RoleOverrides } from "@/config/permissions";
import { resolveAccent } from "@/config/theme";
import { db, presence, settings, users } from "@/db";
import { fmtDateTime, plural } from "@/lib/format";
import { requireAdmin } from "@/modules/auth/guard";
import { resolvePermissions } from "@/modules/permissions/resolve";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireAdmin();
  const [rows, on, [row]] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select({ id: presence.userId }).from(presence).where(gt(presence.lastSeenAt, sql`now() - interval '90 seconds'`)),
    db.select().from(settings).where(eq(settings.key, "role_permissions")),
  ]);
  const online = new Set(on.map((r) => r.id));
  const byRole = (row?.value ?? {}) as RoleOverrides;
  const initial = (r: "user" | "seller" | "manager"): PermissionMap => Object.fromEntries(PERMISSIONS.map((p) => [p.key, byRole[r]?.[p.key] ?? p.defaults.includes(r)]));
  const list: UserRow[] = rows.map((u) => ({ accent: u.accent, id: u.id, username: u.username, name: u.name, roles: u.roles, active: u.active, dailyGoal: u.dailyGoal, canManageGoals: u.canManageGoals, inMetrics: u.inMetrics, permissions: u.permissions, hex: resolveAccent(u.accent, u.roles).hex, navLayout: u.navLayout === "side" ? "side" : "top", navHrefs: orderNav(visibleNav(resolvePermissions(u.roles, u.permissions, byRole), u.roles.includes("admin")).filter((i) => i.href !== "/conta"), u.navOrder ?? []).map((i) => i.href), lastLoginAt: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : null, online: online.has(u.id) }));
  const matrixUsers = rows.filter((u) => u.active && !u.roles.includes("admin")).map((u) => ({ id: u.id, name: u.name, roles: u.roles, perms: (u.permissions ?? {}) as PermissionMap, hex: resolveAccent(u.accent, u.roles).hex }));
  return (
    <div className="space-y-5">
      <PageHead icon={Users} size="md" title="Equipe e acessos" subtitle={`${plural(list.length, "pessoa", "pessoas")} · ${list.filter((u) => u.online).length} online agora`} />
      <TeamWorkspace people={list} matrixUsers={matrixUsers} roles={{ user: initial("user"), seller: initial("seller"), manager: initial("manager") }} myId={me.id} />
    </div>
  );
}
