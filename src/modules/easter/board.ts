"use server";

import { eq } from "drizzle-orm";
import { db, eggNotes, users } from "@/db";
import { NOTE_COLORS, NOTE_MAX, NOTE_STICKERS } from "@/config/egg-board";
import { requireUser } from "@/modules/auth/guard";
import { hasEgg } from "@/modules/achievements/stats";

export type BoardNote = { userId: number; name: string; text: string; color: string; sticker: string; at: string; mine: boolean };
export type BoardReply = { ok: boolean; message?: string; notes?: BoardNote[] };

/** Só quem já encontrou o segredo vê e usa o mural. */
async function gate() {
  const me = await requireUser();
  return (await hasEgg(me.id)) ? me : null;
}

async function load(meId: number): Promise<BoardNote[]> {
  const rows = await db.select({ userId: eggNotes.userId, name: users.name, text: eggNotes.text, color: eggNotes.color, sticker: eggNotes.sticker, at: eggNotes.updatedAt })
    .from(eggNotes).innerJoin(users, eq(users.id, eggNotes.userId)).orderBy(eggNotes.createdAt).limit(200);
  return rows.map((r) => ({ ...r, at: r.at.toISOString(), mine: r.userId === meId }));
}

/** Todos os post-its do mural (mais antigos primeiro). */
export async function listBoardAction(): Promise<BoardReply> {
  const me = await gate();
  if (!me) return { ok: false, message: "O mural é de quem encontrou o segredo." };
  return { ok: true, notes: await load(me.id) };
}

/** Cola (ou troca) o post-it da pessoa: é um por pessoa. */
export async function saveNoteAction(input: { text: string; color: string; sticker: string }): Promise<BoardReply> {
  const me = await gate();
  if (!me) return { ok: false, message: "O mural é de quem encontrou o segredo." };
  const text = String(input.text ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  if (!text) return { ok: false, message: "Escreva uma mensagem para o seu post-it." };
  if (!NOTE_COLORS.some((c) => c.key === input.color) || !NOTE_STICKERS.some((s) => s.key === input.sticker)) return { ok: false, message: "Cor ou adesivo inválido." };
  await db.insert(eggNotes).values({ userId: me.id, text, color: input.color, sticker: input.sticker })
    .onConflictDoUpdate({ target: eggNotes.userId, set: { text, color: input.color, sticker: input.sticker, updatedAt: new Date() } });
  return { ok: true, notes: await load(me.id) };
}

/** Tira o próprio post-it do mural. */
export async function removeNoteAction(): Promise<BoardReply> {
  const me = await gate();
  if (!me) return { ok: false };
  await db.delete(eggNotes).where(eq(eggNotes.userId, me.id));
  return { ok: true, notes: await load(me.id) };
}
