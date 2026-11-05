import { asc } from "drizzle-orm";
import { NewUser } from "@/components/admin/new-user";
import { UserCard, type UserRow } from "@/components/admin/user-card";
import { resolveAccent } from "@/config/theme";
import { db, users } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { requireAdmin } from "@/modules/auth/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireAdmin();
  const rows = await db.select().from(users).orderBy(asc(users.name));
  const list: UserRow[] = rows.map((u) => ({ id: u.id, username: u.username, name: u.name, roles: u.roles, active: u.active, dailyGoal: u.dailyGoal, canManageGoals: u.canManageGoals, inMetrics: u.inMetrics, permissions: u.permissions, hex: resolveAccent(u.accent, u.roles).hex, lastLoginAt: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : null }));
  return (
    <div className="space-y-4">
      <NewUser />
      <ul className="space-y-2">{list.map((u) => <UserCard key={u.id} u={u} isMe={u.id === me.id} />)}</ul>
    </div>
  );
}
