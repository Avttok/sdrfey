"use server";

import { bubbleHex, resolveAccent } from "@/config/theme";
import { achievementsOf } from "@/modules/achievements/stats";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { chatMentions, chatMessages, chatStyles, chatReactions, db, presence, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { publicRoles, type Role } from "@/config/roles";
import { requireUser } from "@/modules/auth/guard";
import { canAccessChannel, channelsFor, dmOther, REACTION_EMOJIS } from "./channels";
import { chatEnabled, DELETE_WINDOW_MS, isMod, listMessages, type ChatMsg } from "./data";
import { searchShareable, shareInfo, shareLabel, type ShareInfo, type ShareItem, type ShareKind } from "./share";

type R<T> = ({ ok: true } & T) | { ok: false; message: string };
const bad = (message: string) => ({ ok: false as const, message });
const kindSchema = z.enum(["lead", "deal", "quote"]);

async function allowed() {
  const me = await requireUser();
  return (await chatEnabled(me)) ? me : null;
}

export async function sendChatMessageAction(input: { channel: string; body: string; share?: { kind: ShareKind; id: number } | null }): Promise<R<{ message: ChatMsg }>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  const p = z.object({ channel: z.string(), body: z.string().max(2000), share: z.object({ kind: kindSchema, id: z.number().int().positive() }).nullish() }).safeParse(input);
  if (!p.success) return bad("Mensagem inválida (máximo 2000 caracteres).");
  const body = p.data.body.trim();
  if (!canAccessChannel(me, p.data.channel)) return bad("Você não tem acesso a este grupo.");
  const other = dmOther(p.data.channel, me.id);
  if (other !== null) { const [o] = await db.select({ active: users.active }).from(users).where(eq(users.id, other)); if (!o?.active || other === me.id) return bad("Essa pessoa não está disponível para conversa."); }
  if (!body && !p.data.share) return bad("Escreva algo ou compartilhe um item.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(chatMessages).where(and(eq(chatMessages.userId, me.id), gt(chatMessages.createdAt, sql`now() - interval '1 minute'`)));
  if (n >= 30) return bad("Muitas mensagens seguidas. Espere um instante.");
  let label: string | null = null;
  if (p.data.share) {
    label = await shareLabel(me, p.data.share.kind, p.data.share.id);
    if (!label) return bad("Você não pode compartilhar esse item.");
  }
  const [row] = await db.insert(chatMessages).values({ channel: p.data.channel, userId: me.id, body, shareKind: p.data.share?.kind ?? null, shareId: p.data.share?.id ?? null, shareLabel: label }).returning({ id: chatMessages.id });
  const [msg] = await listMessages(me, p.data.channel, { after: row.id - 1, limit: 1 });
  return { ok: true, message: msg };
}

export async function deleteChatMessageAction(id: number): Promise<R<object>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  const [m] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
  if (!m || !canAccessChannel(me, m.channel)) return bad("Mensagem não encontrada.");
  if (m.userId !== me.id && !isMod(me)) return bad("Só quem escreveu, gestores e o Adm apagam mensagens.");
  if (!me.isAdmin && Date.now() - m.createdAt.getTime() > DELETE_WINDOW_MS) return bad("Só dá para apagar uma mensagem até 15 minutos depois de enviada.");
  await db.update(chatMessages).set({ deletedAt: new Date() }).where(eq(chatMessages.id, id));
  if (m.userId !== me.id) await logAudit(db, { userId: me.id, entity: "chat", action: "apagou mensagem de outra pessoa", field: m.channel.startsWith("dm:") ? "conversa direta" : m.channel, oldValue: m.channel.startsWith("dm:") ? null : m.body.slice(0, 120), meta: { autor: m.userId } });
  return { ok: true };
}

export async function searchShareAction(kind: ShareKind, q: string): Promise<R<{ items: ShareItem[] }>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  if (!kindSchema.safeParse(kind).success) return bad("Tipo inválido.");
  return { ok: true, items: await searchShareable(me, kind, q.slice(0, 80)) };
}

/** Abre o item compartilhado numa mensagem (só leitura). Vale para quem tem acesso ao canal da mensagem. */
export async function sharedInfoAction(messageId: number): Promise<R<{ info: ShareInfo }>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  const [m] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId));
  if (!m || m.deletedAt || !m.shareKind || !m.shareId || !canAccessChannel(me, m.channel)) return bad("Item não encontrado.");
  return { ok: true, info: await shareInfo(me, m.shareKind, m.shareId) };
}

export async function toggleReactionAction(messageId: number, emoji: string): Promise<R<object>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) return bad("Reação inválida.");
  const [m] = await db.select({ channel: chatMessages.channel, deletedAt: chatMessages.deletedAt }).from(chatMessages).where(eq(chatMessages.id, messageId));
  if (!m || m.deletedAt || !canAccessChannel(me, m.channel)) return bad("Mensagem não encontrada.");
  const gone = await db.delete(chatReactions).where(and(eq(chatReactions.messageId, messageId), eq(chatReactions.userId, me.id), eq(chatReactions.emoji, emoji))).returning({ id: chatReactions.messageId });
  if (!gone.length) await db.insert(chatReactions).values({ messageId, userId: me.id, emoji }).onConflictDoNothing();
  return { ok: true };
}

export type ChatProfile = { avatar: string | null; banner: string | null; id: number; name: string; username: string; roles: Role[]; sent: number; lastLoginAt: string | null; active: boolean; isAdminView: boolean; /** conquistas liberadas (só chaves; o ícone vem do catálogo) */ badges: { key: string; name: string }[]; badgeTotal: number; style: Record<string, string>; theme: { hex: string; hex2: string | null; on: string } };

/** Perfil de quem escreveu. Todos veem nome, @usuário e cargos; o Adm vê também situação e último acesso. */
export async function chatProfileAction(userId: number): Promise<R<{ profile: ChatProfile }>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return bad("Conta não encontrada.");
  const admin = me.isAdmin;
  if (!u.inMetrics && !admin && u.id !== me.id) return bad("Conta não encontrada.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(chatMessages).where(and(eq(chatMessages.userId, userId), sql`${chatMessages.deletedAt} is null`));
  const { list } = await achievementsOf(u.id, u.roles);
  const got = list.filter((a) => a.earned).sort((a, b) => b.goal - a.goal || a.key.localeCompare(b.key));
  const [st] = await db.select().from(chatStyles).where(eq(chatStyles.userId, u.id));
  const ac = resolveAccent(u.accent, u.roles as Role[]);
  return { ok: true, profile: { theme: { hex: ac.hex, hex2: ac.hex2, on: ac.onAccent }, badges: got.map((a) => ({ key: a.key, name: a.name })), badgeTotal: list.length, style: st?.equipped ?? {}, avatar: u.avatar ?? null, banner: u.banner ?? null, id: u.id, name: u.name, username: u.username, roles: publicRoles(u.roles as Role[], admin), sent: n, active: u.active, lastLoginAt: admin ? (await lastAccessOf(u.id, u.lastLoginAt))?.toISOString() ?? null : null, isAdminView: admin } };
}

/** Só o Adm: apaga todas as mensagens de um grupo, ou todas as de uma pessoa (em um grupo ou em todos). */
export async function adminChatPurgeAction(input: { channel?: string; userId?: number }): Promise<R<{ removed: number }>> {
  const me = await requireUser();
  if (!me.isAdmin) return bad("Só o Adm pode fazer isso.");
  const p = z.object({ channel: z.string().optional(), userId: z.number().int().positive().optional() }).safeParse(input);
  if (!p.success || (!p.data.channel && !p.data.userId)) return bad("Escolha o grupo ou a pessoa.");
  const gone = await db.delete(chatMessages).where(and(p.data.channel ? eq(chatMessages.channel, p.data.channel) : undefined, p.data.userId ? eq(chatMessages.userId, p.data.userId) : undefined)).returning({ id: chatMessages.id });
  await logAudit(db, { userId: me.id, entity: "setting", action: "apagou mensagens do chat", field: p.data.channel ?? "pessoa", newValue: `${gone.length} mensagens${p.data.userId ? ` (conta ${p.data.userId})` : ""}` });
  return { ok: true, removed: gone.length };
}

/** @usuario no texto vira aviso para a pessoa, se ela puder ver esse canal (na conversa privada, só o outro participante). */
async function saveMentions(authorId: number, channel: string, messageId: number, body: string) {
  const names = [...new Set([...body.matchAll(/(?:^|[^\w@])@([a-z0-9][a-z0-9._-]{1,40})/gi)].map((m) => m[1].toLowerCase().replace(/[._-]+$/, "")))].slice(0, 10);
  if (!names.length) return;
  const found = await db.select({ id: users.id, roles: users.roles }).from(users).where(and(eq(users.active, true), sql`lower(${users.username}) in (${sql.join(names.map((n) => sql`${n}`), sql`, `)})`));
  const ok = found.filter((u) => u.id !== authorId && (channel.startsWith("dm:") ? dmOther(channel, authorId) === u.id : channelsFor(u.roles as Role[]).some((c) => c.key === channel)));
  if (ok.length) await db.insert(chatMentions).values(ok.map((u) => ({ messageId, userId: u.id }))).onConflictDoNothing();
}

export type ChatPerson = { id: number; name: string; username: string; hex: string };
/** Pessoas para marcar (@) e para abrir conversa privada. */
export async function chatPeopleAction(): Promise<R<{ people: ChatPerson[] }>> {
  const me = await allowed();
  if (!me) return bad("O chat está desligado.");
  const rows = await db.select({ id: users.id, name: users.name, username: users.username, accent: users.accent, roles: users.roles }).from(users).where(and(eq(users.active, true), sql`${users.id} <> ${me.id}`)).orderBy(users.name);
  return { ok: true, people: rows.map((u) => ({ id: u.id, name: u.name, username: u.username, hex: bubbleHex(u.accent, u.id, u.roles as Role[]) })) };
}

/** Último acesso: o mais recente entre o login e a última vez vista no sistema. */
async function lastAccessOf(id: number, login: Date | null): Promise<Date | null> {
  const [p] = await db.select({ at: presence.lastSeenAt }).from(presence).where(eq(presence.userId, id)).limit(1);
  const l = [login, p?.at].filter((x): x is Date => !!x);
  return l.length ? new Date(Math.max(...l.map((d) => d.getTime()))) : null;
}
