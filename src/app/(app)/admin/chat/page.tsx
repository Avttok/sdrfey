import { inArray, sql } from "drizzle-orm";
import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { db, users } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { requireAdmin } from "@/modules/auth/guard";
import { CHANNELS, parseDm } from "@/modules/chat/channels";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await requireAdmin();
  const sel = (await searchParams).c ?? "geral";
  const convs = await db.execute<{ channel: string; n: number; last: Date }>(sql`select channel, count(*) filter (where deleted_at is null)::int as n, max(created_at) as last from chat_messages group by channel order by max(created_at) desc`);
  const ids = [...new Set(convs.flatMap((c) => parseDm(c.channel) ?? []))];
  const names = ids.length ? new Map((await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids))).map((u) => [u.id, u.name.split(" ")[0]])) : new Map<number, string>();
  const label = (k: string) => { const d = parseDm(k); return d ? `${names.get(d[0]) ?? d[0]} ↔ ${names.get(d[1]) ?? d[1]}` : CHANNELS.find((c) => c.key === k)?.label ?? k; };
  const list = [...CHANNELS.map((c) => c.key), ...convs.map((c) => c.channel)].filter((k, i, a) => a.indexOf(k) === i);
  const info = new Map(convs.map((c) => [c.channel, c]));
  const msgs = await db.execute<{ id: number; name: string | null; body: string; share_label: string | null; at: Date; deleted: boolean }>(sql`
    select m.id, u.name, m.body, m.share_label, m.created_at as at, (m.deleted_at is not null) as deleted
    from (select * from chat_messages where channel = ${sel} order by id desc limit 300) m left join users u on u.id = m.user_id order by m.id`);
  return (
    <div className="space-y-5">
      <PageHead icon={MessagesSquare} hex="#06b6d4" title="Chat (tudo)" />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <nav className={`${panelCls} max-h-[70vh] space-y-1 overflow-y-auto p-2`} aria-label="Conversas">
          {list.map((k) => (
            <Link key={k} href={`/admin/chat?c=${encodeURIComponent(k)}`} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${sel === k ? "bg-grad-soft font-semibold text-accent" : "hover:bg-sunk"}`}>
              <span className="min-w-0 flex-1 truncate">{label(k)}{k.startsWith("dm:") && <span className="ml-1.5 rounded bg-sunk px-1 text-[10px] text-muted">direta</span>}</span>
              <span className="figure text-xs text-muted">{info.get(k)?.n ?? 0}</span>
            </Link>
          ))}
        </nav>
        <section className={`${panelCls} p-4`}>
          <h2 className="display mb-3 text-lg">{label(sel)}</h2>
          {msgs.length === 0 ? <p className="text-sm text-muted">Sem mensagens.</p> : (
            <ul className="max-h-[65vh] space-y-2 overflow-y-auto">
              {msgs.map((m) => (
                <li key={m.id} className={`rounded-xl bg-sunk px-3 py-2 text-sm ${m.deleted ? "opacity-50" : ""}`}>
                  <p className="mb-0.5 flex items-center gap-2 text-xs text-muted"><b className="text-ink">{m.name ?? "Conta removida"}</b>{fmtDateTime(m.at)}{m.deleted && <span className="rounded bg-danger/15 px-1.5 text-danger">apagada</span>}</p>
                  <p className="whitespace-pre-wrap break-words">{m.body}{m.share_label ? <span className="ml-1 text-accent">[{m.share_label}]</span> : null}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
