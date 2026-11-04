import { desc, eq } from "drizzle-orm";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { panelCls } from "@/components/ui";
import { db, leads, presence, users } from "@/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await db
    .select({ name: users.name, last: presence.lastSeenAt, activity: presence.activity, company: leads.company })
    .from(presence).innerJoin(users, eq(users.id, presence.userId)).leftJoin(leads, eq(leads.id, presence.leadId))
    .orderBy(desc(presence.lastSeenAt));
  const now = Date.now();
  return (
    <div className="space-y-3">
      <LiveRefresh />
      <p className="text-sm text-muted">Online = atividade nos últimos 90 segundos. A página se atualiza sozinha a cada 30 segundos.</p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const secs = Math.round((now - r.last.getTime()) / 1000);
          const online = secs < 90;
          return (
            <li key={r.name} className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
              <span className={`size-2.5 rounded-full ${online ? "bg-ok" : "bg-muted/50"}`} aria-hidden />
              <span className="font-medium">{r.name}</span>
              <span className="text-sm text-muted">{online ? (r.activity ?? "Online") : `Offline · visto ${fmtDateTime(r.last)}`}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className={`${panelCls} p-6 text-center text-muted`}>Ninguém acessou ainda.</li>}
      </ul>
    </div>
  );
}
