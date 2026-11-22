"use server";

import { and, eq, sql } from "drizzle-orm";
import { db, notifications } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { notify } from "@/modules/notifications/notify";

/** Avisa no sino, uma vez por dia, que a meta foi batida. */
export async function goalReachedAction(label: string): Promise<void> {
  const me = await requireUser();
  const [seen] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, me.id), eq(notifications.kind, "meta"), sql`${notifications.createdAt} >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`)).limit(1);
  if (seen) return;
  await notify(me.id, { kind: "meta", title: "Meta do dia batida! 🏆", body: `${String(label).slice(0, 40)}: parabéns, você chegou lá.`, href: "/painel" });
}
