import { desc, eq } from "drizzle-orm";
import { Radio } from "lucide-react";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import { db, leads, presence, users } from "@/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db
    .select({ name: users.name, accent: users.accent, roles: users.roles, uid: users.id, last: presence.lastSeenAt, activity: presence.activity, company: leads.company })
    .from(presence).innerJoin(users, eq(users.id, presence.userId)).leftJoin(leads, eq(leads.id, presence.leadId))
    .orderBy(desc(presence.lastSeenAt));
  const now = Date.now();
  const list = rows.map((r) => ({ ...r, online: now - r.last.getTime() < 90_000 })).sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <div className="space-y-5">
      <LiveRefresh />
      <PageHead icon={Radio} size="md" title="Ao vivo" subtitle={`${list.filter((r) => r.online).length} online agora · online = atividade nos últimos 90 s · atualiza sozinho a cada 30 s`} />
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
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate text-sm text-muted">{r.online ? (r.activity ?? "Online") : `Offline · visto ${fmtDateTime(r.last)}`}</p>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className={`${panelCls} p-10 text-center text-muted md:col-span-2`}>Ninguém acessou ainda.</li>}
      </ul>
    </div>
  );
}
