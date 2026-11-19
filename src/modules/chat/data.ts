import { and, desc, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { chatMentions, chatMessages, chatReactions, chatReads, chatStyles, db, users } from "@/db";
import { publicRoles, type Role } from "@/config/roles";
import { bubbleHex } from "@/config/theme";
import type { CurrentUser } from "@/modules/auth/guard";
import { getSettings } from "@/modules/settings/get";
import { channelsFor, dmOther } from "./channels";

export type Reaction = { emoji: string; count: number; mine: boolean; names: string[] };
export type ChatMsg = {
  id: number; channel: string; userId: number | null; name: string; roles: Role[]; hex: string; body: string; at: string; reactions: Reaction[];
  share: { kind: "lead" | "deal" | "quote"; id: number; label: string } | null;
  canDelete: boolean;
  /** até quando dá para apagar (ms); null = sem limite (Adm) */
  delUntil: number | null;
  /** itens da loja vestidos por quem enviou */
  style: Record<string, string>;
};

/** O chat está disponível para esta conta? (ligado pelo Adm e permissão de uso) */
export async function chatEnabled(me: CurrentUser): Promise<boolean> {
  if (!me.permissions["chat.use"]) return false;
  return (await getSettings()).chat_on === 1;
}

/** Prazo para apagar a própria mensagem (o Adm apaga sempre). */
export const DELETE_WINDOW_MS = 15 * 60_000;
export const isMod = (me: CurrentUser) => me.roles.includes("admin") || me.roles.includes("manager");

export async function listMessages(me: CurrentUser, channel: string, o: { after?: number; before?: number; limit?: number } = {}): Promise<ChatMsg[]> {
  const limit = Math.min(o.limit ?? 40, 100);
  const where = and(eq(chatMessages.channel, channel), sql`${chatMessages.deletedAt} is null`, o.after ? gt(chatMessages.id, o.after) : undefined, o.before ? lt(chatMessages.id, o.before) : undefined);
  const rows = await db.select({ m: chatMessages, name: users.name, accent: users.accent, roles: users.roles, eq: chatStyles.equipped }).from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.userId)).leftJoin(chatStyles, eq(chatStyles.userId, chatMessages.userId)).where(where)
    .orderBy(o.after ? chatMessages.id : desc(chatMessages.id)).limit(limit);
  const list = o.after ? rows : rows.reverse();
  const mod = isMod(me);
  const rx = await reactionsFor(me, list.map(({ m }) => m.id));
  return list.map(({ m, name, accent, roles, eq: styleEq }) => ({
    style: styleEq ?? {},
    id: m.id, channel: m.channel, userId: m.userId, name: name ?? "Conta removida", roles: publicRoles((roles ?? []) as Role[], me.roles.includes("admin")), reactions: rx[m.id] ?? [], hex: m.userId ? bubbleHex(accent, m.userId, roles ?? undefined) : "#888780",
    body: m.body, at: m.createdAt.toISOString(),
    share: m.shareKind && m.shareId ? { kind: m.shareKind, id: m.shareId, label: m.shareLabel ?? "" } : null,
    canDelete: mod || m.userId === me.id,
    delUntil: me.roles.includes("admin") ? null : m.createdAt.getTime() + DELETE_WINDOW_MS,
  }));
}

/** Reações agrupadas por mensagem. */
export async function reactionsFor(me: CurrentUser, ids: number[]): Promise<Record<number, Reaction[]>> {
  if (!ids.length) return {};
  const rows = await db.select({ messageId: chatReactions.messageId, emoji: chatReactions.emoji, userId: chatReactions.userId, name: users.name }).from(chatReactions)
    .innerJoin(users, eq(users.id, chatReactions.userId)).where(inArray(chatReactions.messageId, ids)).orderBy(chatReactions.messageId);
  const out: Record<number, Reaction[]> = {};
  for (const r of rows) {
    const list = (out[r.messageId] ??= []);
    let x = list.find((y) => y.emoji === r.emoji);
    if (!x) { x = { emoji: r.emoji, count: 0, mine: false, names: [] }; list.push(x); }
    x.count++; x.mine ||= r.userId === me.id; x.names.push(r.name.split(" ")[0]);
  }
  return out;
}

/** Reações de todas as mensagens carregadas na tela (a partir de um id), para atualizar quem já abriu. */
export async function reactionsSince(me: CurrentUser, channel: string, fromId: number): Promise<Record<number, Reaction[]>> {
  const ids = (await db.select({ id: chatMessages.id }).from(chatMessages).where(and(eq(chatMessages.channel, channel), gt(chatMessages.id, fromId - 1), sql`${chatMessages.deletedAt} is null`)).limit(150)).map((r) => r.id);
  const rx = await reactionsFor(me, ids);
  return Object.fromEntries(ids.map((id) => [id, rx[id] ?? []]));
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
  const keys = [...channelsFor(me.roles).map((c) => c.key), ...(await dmKeys(me.id))];
  const rows = await db.execute<{ channel: string; n: number }>(sql`
    select m.channel, count(*)::int as n from chat_messages m
    left join chat_reads r on r.user_id = ${me.id} and r.channel = m.channel
    where m.channel in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)}) and m.deleted_at is null and m.user_id is distinct from ${me.id} and m.id > coalesce(r.last_id, 0)
    group by m.channel`);
  return Object.fromEntries(rows.map((r) => [r.channel, r.n]));
}

/** Canais de conversa privada em que a pessoa já trocou mensagens. */
async function dmKeys(meId: number): Promise<string[]> {
  const rows = await db.execute<{ channel: string }>(sql`select distinct channel from chat_messages where channel like 'dm:%' and (channel like ${`dm:${meId}-%`} or channel like ${`dm:%-${meId}`})`);
  return rows.map((r) => r.channel).filter((k) => dmOther(k, meId) !== null);
}

export type DmItem = { key: string; withId: number; name: string; username: string; hex: string };
/** Conversas privadas da pessoa, com o nome de quem está do outro lado. */
export async function dmList(me: CurrentUser): Promise<DmItem[]> {
  const keys = await dmKeys(me.id);
  const ids = keys.map((k) => dmOther(k, me.id)!);
  if (!ids.length) return [];
  const rows = await db.select({ id: users.id, name: users.name, username: users.username, accent: users.accent, roles: users.roles }).from(users).where(inArray(users.id, ids));
  return keys.flatMap((key) => { const u = rows.find((r) => r.id === dmOther(key, me.id)); return u ? [{ key, withId: u.id, name: u.name, username: u.username, hex: bubbleHex(u.accent, u.id, u.roles as Role[]) }] : []; });
}

export type MentionToast = { id: number; by: string; channel: string; preview: string };
/** Marcações ainda não avisadas: entrega uma vez só (marca como avisada na mesma consulta). */
export async function takeMentions(me: CurrentUser): Promise<MentionToast[]> {
  const rows = await db.execute<{ id: number; by: string | null; channel: string; body: string; share_label: string | null }>(sql`
    with t as (update chat_mentions set notified_at = now() where user_id = ${me.id} and notified_at is null returning message_id)
    select m.id, u.name as by, m.channel, m.body, m.share_label from t join chat_messages m on m.id = t.message_id left join users u on u.id = m.user_id
    where m.deleted_at is null order by m.id limit 10`);
  return rows.map((r) => ({ id: r.id, by: r.by ?? "Alguém", channel: r.channel, preview: (r.body || r.share_label || "").slice(0, 90) }));
}
