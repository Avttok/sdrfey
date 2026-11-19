import { and, asc, eq, sql } from "drizzle-orm";
import { KeyRound } from "lucide-react";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { PageHead } from "@/components/page-head";
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
  const initial = (r: "user" | "seller" | "manager"): PermissionMap => Object.fromEntries(PERMISSIONS.map((p) => [p.key, o[r]?.[p.key] ?? p.defaults.includes(r)]));
  return (
    <div className="space-y-5">
      <PageHead icon={KeyRound} size="md" title="Permissões" />
      <PermissionMatrix roles={{ user: initial("user"), seller: initial("seller"), manager: initial("manager") }} users={people.map((u) => ({ id: u.id, name: u.name, roles: u.roles, perms: (u.permissions ?? {}) as PermissionMap, hex: resolveAccent(u.accent, u.roles).hex }))} />
    </div>
  );
}
