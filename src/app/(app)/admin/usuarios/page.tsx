import { asc, gt, sql } from "drizzle-orm";
import { Users } from "lucide-react";
import { NewUser } from "@/components/admin/new-user";
import { UserCard, type UserRow } from "@/components/admin/user-card";
import { PageHead } from "@/components/page-head";
import { resolveAccent } from "@/config/theme";
import { db, presence, users } from "@/db";
import { fmtDateTime, plural } from "@/lib/format";
import { requireAdmin } from "@/modules/auth/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireAdmin();
  const [rows, on] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select({ id: presence.userId }).from(presence).where(gt(presence.lastSeenAt, sql`now() - interval '90 seconds'`)),
  ]);
  const online = new Set(on.map((r) => r.id));
  const list: UserRow[] = rows.map((u) => ({ id: u.id, username: u.username, name: u.name, roles: u.roles, active: u.active, dailyGoal: u.dailyGoal, canManageGoals: u.canManageGoals, inMetrics: u.inMetrics, permissions: u.permissions, hex: resolveAccent(u.accent, u.roles).hex, lastLoginAt: u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : null, online: online.has(u.id) }));
  return (
    <div className="space-y-5">
      <PageHead icon={Users} size="md" title="Usuários" subtitle={`${plural(list.length, "pessoa", "pessoas")} · ${list.filter((u) => u.online).length} online agora`} />
      <NewUser />
      <ul className="grid gap-3 md:grid-cols-2">{list.map((u) => <UserCard key={u.id} u={u} isMe={u.id === me.id} />)}</ul>
    </div>
  );
}
