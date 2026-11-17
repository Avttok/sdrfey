"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { chatMessages, db } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { canUseChannel } from "./channels";
import { chatEnabled, isMod, listMessages, type ChatMsg } from "./data";
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
  if (!canUseChannel(me.roles, p.data.channel)) return bad("Você não tem acesso a este grupo.");
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
  if (!m || !canUseChannel(me.roles, m.channel)) return bad("Mensagem não encontrada.");
  if (m.userId !== me.id && !isMod(me)) return bad("Só quem escreveu, gestores e o Adm apagam mensagens.");
  await db.update(chatMessages).set({ deletedAt: new Date() }).where(eq(chatMessages.id, id));
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
  if (!m || m.deletedAt || !m.shareKind || !m.shareId || !canUseChannel(me.roles, m.channel)) return bad("Item não encontrado.");
  return { ok: true, info: await shareInfo(me, m.shareKind, m.shareId) };
}
