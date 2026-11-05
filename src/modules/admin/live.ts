"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leads, presence, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";

/** Devolve ao sorteio os leads que estão com alguém. Fecha os atendimentos abertos como "liberado". */
async function freeLocks(userId?: number): Promise<number> {
  const where = userId ? and(eq(leads.lockedBy, userId)) : sql`${leads.lockedBy} is not null`;
  const freed = await db.update(leads).set({ lockedBy: null, lockedAt: null }).where(where).returning({ id: leads.id });
  if (freed.length) {
    const ids = sql.join(freed.map((f) => sql`${f.id}`), sql`, `);
    await db.execute(sql`update attendance_sessions set outcome = 'released' where outcome is null and lead_id in (${ids})`);
  }
  return freed.length;
}

/** Congestionou? Solta todos os leads travados de uma vez (cada pessoa recebe um novo no próximo Shuffler). */
export async function releaseAllLeadsAction(): Promise<ActionResult> {
  const me = await requireAdmin();
  const n = await freeLocks();
  await logAudit(db, { userId: me.id, entity: "lead", action: "liberou todos os leads", field: "Leads em atendimento", oldValue: String(n), newValue: "0", meta: { leads: n } });
  revalidatePath("/", "layout");
  return { ok: true, message: n === 0 ? "Nenhum lead estava preso." : n === 1 ? "1 lead foi liberado." : `${n} leads foram liberados.` };
}

/** Derruba a sessão de uma pessoa (ela precisa entrar de novo) e solta o lead que estava com ela. */
export async function disconnectUserAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false, message: "Para sair da sua própria conta, use o menu Sair." };
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) return { ok: false, message: "Usuário não encontrado." };
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  await db.delete(presence).where(eq(presence.userId, id));
  const freed = await freeLocks(id);
  await logAudit(db, { userId: me.id, entity: "user", action: "desconectou usuário", field: "Sessão", meta: { usuario: u.username, leadsLiberados: freed } });
  revalidatePath("/admin/ao-vivo");
  return { ok: true, message: `${u.name} foi desconectado${freed ? ` e ${freed === 1 ? "1 lead foi liberado" : `${freed} leads foram liberados`}` : ""}.` };
}

/** Desconecta todo mundo, menos quem está pedindo. */
export async function disconnectAllAction(): Promise<ActionResult> {
  const me = await requireAdmin();
  const hit = await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(ne(users.id, me.id)).returning({ id: users.id });
  await db.delete(presence).where(ne(presence.userId, me.id));
  const freed = await freeLocks();
  await logAudit(db, { userId: me.id, entity: "user", action: "desconectou todos os usuários", field: "Sessão", meta: { pessoas: hit.length, leadsLiberados: freed } });
  revalidatePath("/admin/ao-vivo");
  return { ok: true, message: `${hit.length === 1 ? "1 pessoa foi desconectada" : `${hit.length} pessoas foram desconectadas`}.` };
}
