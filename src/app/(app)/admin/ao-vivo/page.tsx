import { desc, eq } from "drizzle-orm";
import { Radio } from "lucide-react";
import { DisconnectButton, LiveToolbar } from "@/components/admin/live-actions";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { ActivityIcon } from "@/components/activity-icon";
import { RoleBadge } from "@/components/role-badge";
import { topRole } from "@/config/roles";
import { requireAdmin } from "@/modules/auth/guard";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import { db, leads, presence, users } from "@/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireAdmin();
  const rows = await db
    .select({ name: users.name, accent: users.accent, roles: users.roles, uid: users.id, last: presence.lastSeenAt, activity: presence.activity, company: leads.company })
    .from(users).leftJoin(presence, eq(users.id, presence.userId)).leftJoin(leads, eq(leads.id, presence.leadId))
    .where(eq(users.active, true))
    .orderBy(desc(presence.lastSeenAt), users.name);
  const now = Date.now();
  const list = rows.map((r) => ({ ...r, online: !!r.last && now - r.last.getTime() < 90_000 })).sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <div className="space-y-5">
      <LiveRefresh />
      <PageHead icon={Radio} size="md" title="Ao vivo" subtitle={`${list.filter((r) => r.online).length} de ${list.length} online agora · atualiza sozinho a cada 30 s`}><LiveToolbar /></PageHead>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((r) => {
          const hex = bubbleHex(r.accent, r.uid, r.roles);
          return (
            <li key={r.uid} className={`${panelCls} flex items-center gap-3 p-4 ${r.online ? "" : "opacity-70"}`}>
              <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-bold" style={{ background: `color-mix(in srgb, ${hex} 26%, transparent)`, color: `color-mix(in srgb, ${hex} 80%, var(--ink))` }}>
                {r.name.slice(0, 2).toUpperCase()}
                <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-panel ${r.online ? "animate-pulse bg-ok" : "bg-muted/50"}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">{r.name}<RoleBadge role={topRole(r.roles)} /></p>
                <p className={`flex items-center gap-1.5 truncate text-sm ${!r.online ? "text-muted" : r.activity?.startsWith("Ausente") ? "text-warn" : "text-ok"}`}>
                  <ActivityIcon text={r.online ? r.activity : null} kind={r.online ? undefined : "away"} size={14} className="shrink-0" />
                  <span className="truncate">{r.online ? (r.activity ?? "Online") : (r.last ? `Offline · visto ${fmtDateTime(r.last)}` : "Nunca acessou")}</span>
                </p>
              </div>
              {r.uid !== me.id && <DisconnectButton id={r.uid} name={r.name} />}
            </li>
          );
        })}
        {list.length === 0 && <li className={`${panelCls} p-10 text-center text-muted md:col-span-2`}>Nenhuma conta ativa.</li>}
      </ul>
    </div>
  );
}
