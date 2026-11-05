import { and, asc, eq, sql } from "drizzle-orm";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { PERMISSIONS, type PermissionMap, type RoleOverrides } from "@/config/permissions";
import { resolveAccent } from "@/config/theme";
import { db, settings, users } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [[row], people] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "role_permissions")),
    db.select().from(users).where(and(eq(users.active, true), sql`not ('admin' = any(${users.roles}))`)).orderBy(asc(users.name)),
  ]);
  const o = (row?.value ?? {}) as RoleOverrides;
  const initial = (r: "user" | "manager"): PermissionMap => Object.fromEntries(PERMISSIONS.map((p) => [p.key, o[r]?.[p.key] ?? p.defaults.includes(r)]));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Controle numa grade só o que cada cargo e cada pessoa vê e pode fazer. Clique, ajuste e salve no fim.</p>
      <PermissionMatrix roles={{ user: initial("user"), manager: initial("manager") }} users={people.map((u) => ({ id: u.id, name: u.name, roles: u.roles, perms: (u.permissions ?? {}) as PermissionMap, hex: resolveAccent(u.accent, u.roles).hex }))} />
    </div>
  );
}
