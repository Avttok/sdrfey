import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { chatMessages, chatReads, db, users } from "@/db";
import { bubbleHex } from "@/config/theme";
import type { CurrentUser } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";
import { channelsFor } from "./channels";

export type ChatMsg = {
  id: number; channel: string; userId: number | null; name: string; hex: string; body: string; at: string;
  share: { kind: "lead" | "deal" | "quote"; id: number; label: string } | null;
  canDelete: boolean;
};

/** O chat está disponível para esta conta? (ligado pelo Adm e permissão de uso) */
export async function chatEnabled(me: CurrentUser): Promise<boolean> {
  if (!me.permissions["chat.use"]) return false;
  return (await getSettings()).chat_on === 1;
}

export const isMod = (me: CurrentUser) => me.roles.includes("admin") || me.roles.includes("manager");

export async function listMessages(me: CurrentUser, channel: string, o: { after?: number; before?: number; limit?: number } = {}): Promise<ChatMsg[]> {
  const limit = Math.min(o.limit ?? 40, 100);
  const where = and(eq(chatMessages.channel, channel), sql`${chatMessages.deletedAt} is null`, o.after ? gt(chatMessages.id, o.after) : undefined, o.before ? lt(chatMessages.id, o.before) : undefined);
  const rows = await db.select({ m: chatMessages, name: users.name, accent: users.accent, roles: users.roles }).from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.userId)).where(where)
    .orderBy(o.after ? chatMessages.id : desc(chatMessages.id)).limit(limit);
  const list = o.after ? rows : rows.reverse();
  const mod = isMod(me);
  return list.map(({ m, name, accent, roles }) => ({
    id: m.id, channel: m.channel, userId: m.userId, name: name ?? "Conta removida", hex: m.userId ? bubbleHex(accent, m.userId, roles ?? undefined) : "#888780",
    body: m.body, at: m.createdAt.toISOString(),
    share: m.shareKind && m.shareId ? { kind: m.shareKind, id: m.shareId, label: m.shareLabel ?? "" } : null,
    canDelete: mod || m.userId === me.id,
  }));
}

/** Mensagens apagadas a partir de um ponto (para sumirem na tela de quem já carregou). */
export async function deletedSince(channel: string, fromId: number): Promise<number[]> {
  const r = await db.select({ id: chatMessages.id }).from(chatMessages).where(and(eq(chatMessages.channel, channel), isNotNull(chatMessages.deletedAt), gt(chatMessages.id, fromId - 1))).limit(200);
  return r.map((x) => x.id);
}

/** Marca como lido até `upto` (o último id que a pessoa realmente recebeu na tela). */
export async function markRead(me: CurrentUser, channel: string, upto: number) {
  if (upto <= 0) return;
  await db.insert(chatReads).values({ userId: me.id, channel, lastId: upto }).onConflictDoUpdate({ target: [chatReads.userId, chatReads.channel], set: { lastId: sql`greatest(${chatReads.lastId}, ${upto})` } });
}

/** Não lidas por canal (mensagens de outras pessoas depois da última leitura). */
export async function unreadByChannel(me: CurrentUser): Promise<Record<string, number>> {
  const keys = channelsFor(me.roles).map((c) => c.key);
  const rows = await db.execute<{ channel: string; n: number }>(sql`
    select m.channel, count(*)::int as n from chat_messages m
    left join chat_reads r on r.user_id = ${me.id} and r.channel = m.channel
    where m.channel in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)}) and m.deleted_at is null and m.user_id is distinct from ${me.id} and m.id > coalesce(r.last_id, 0)
    group by m.channel`);
  return Object.fromEntries(rows.map((r) => [r.channel, r.n]));
}
