import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, notifications, type Db } from "@/db";
import type { DbOrTx } from "@/modules/audit/log";
import type { NotifKind, NotifView } from "@/config/notifications";

type Tx = DbOrTx | Db;

/** Cria uma notificação (ou várias). Nunca derruba quem chamou: a notificação é um extra. */
export async function notify(userIds: number | number[], n: { kind: NotifKind; title: string; body?: string | null; href?: string | null }, tx: Tx = db): Promise<void> {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return;
  try {
    await tx.insert(notifications).values(ids.map((userId) => ({ userId, kind: n.kind, title: n.title.slice(0, 120), body: n.body ? n.body.slice(0, 240) : null, href: n.href && n.href.startsWith("/") ? n.href.slice(0, 200) : null })));
  } catch { /* extra: não atrapalha a ação principal */ }
}

export async function listNotifications(userId: number, limit = 30): Promise<{ items: NotifView[]; unread: number }> {
  const [rows, [u]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.id)).limit(limit),
    db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { unread: u?.n ?? 0, items: rows.map((r) => ({ id: r.id, kind: r.kind as NotifView["kind"], title: r.title, body: r.body, href: r.href, read: !!r.readAt, at: r.createdAt.toISOString() })) };
}

export async function markRead(userId: number, ids: number[] | "all"): Promise<void> {
  const where = ids === "all" ? and(eq(notifications.userId, userId), isNull(notifications.readAt)) : and(eq(notifications.userId, userId), inArray(notifications.id, ids.slice(0, 100)), isNull(notifications.readAt));
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}

/** Limpa as já lidas e o que passou de 60 dias. */
export async function clearRead(userId: number): Promise<void> {
  await db.delete(notifications).where(and(eq(notifications.userId, userId), sql`(${notifications.readAt} is not null or ${notifications.createdAt} < now() - interval '60 days')`));
}
