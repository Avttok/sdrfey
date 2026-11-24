"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, settings, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { getCurrentUser, requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";
import { parseVocall, VOCALL_KEY } from "./config";

const fail = (message: string): ActionResult => ({ ok: false, message });

const hostOk = /^[a-z0-9]([a-z0-9.-]{0,120}[a-z0-9])?$/i;

/** Liga/desliga e configura a ligação pelo VocallAgent. Só o Adm. */
export async function saveVocallConfigAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const c = parseVocall(input);
  if (c.on && !c.host) return fail("Informe o endereço do servidor do VocallAgent.");
  if (c.host && !hostOk.test(c.host)) return fail("Endereço inválido. Use só o nome ou IP, sem http:// e sem porta.");
  await db.insert(settings).values({ key: VOCALL_KEY, value: c, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: c, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou ligação VocallPhone", field: VOCALL_KEY, newValue: c.on ? `ligada (${c.host}:${c.port})` : "desligada" });
  revalidatePath("/admin/ligacoes");
  revalidatePath("/", "layout");
  return { ok: true, message: "Configuração salva." };
}

/** Código do agente e ramal de cada pessoa (como aparecem na EOX). Vazio = a pessoa não liga pelo sistema. */
export async function saveVocallUserAction(userId: number, agentId: string, ramal: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({ userId: z.number().int(), agentId: z.string().trim().max(30).regex(/^[A-Za-z0-9._-]*$/, "Use só letras, números e . _ -"), ramal: z.string().trim().max(30).regex(/^[A-Za-z0-9._-]*$/, "Use só letras, números e . _ -") }).safeParse({ userId, agentId, ramal });
  if (!p.success) return fail(p.error.issues[0].message);
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return fail("Pessoa não encontrada.");
  await db.update(users).set({ vocallAgentId: p.data.agentId || null, vocallRamal: p.data.ramal || null }).where(eq(users.id, userId));
  await logAudit(db, { userId: me.id, entity: "user", action: "definiu agente VocallPhone", field: u.name, newValue: p.data.agentId ? `agente ${p.data.agentId} · ramal ${p.data.ramal}` : "removido" });
  revalidatePath("/admin/ligacoes");
  revalidatePath("/", "layout");
  return { ok: true, message: `${u.name.split(" ")[0]} atualizado.` };
}

/** Cada pessoa ajusta o próprio agente e ramal. Só quem tem a função de discador (ou o Adm): se o Adm tirou o discador, não muda. */
export async function saveMyVocallAction(agentId: string, ramal: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return fail("Entre de novo.");
  if (!me.isAdmin && !me.permissions["fn.dialer"]) return fail("Você não tem permissão para usar o discador.");
  const p = z.object({ agentId: z.string().trim().max(30).regex(/^[A-Za-z0-9._-]*$/, "Use só letras, números e . _ -"), ramal: z.string().trim().max(30).regex(/^[A-Za-z0-9._-]*$/, "Use só letras, números e . _ -") }).safeParse({ agentId, ramal });
  if (!p.success) return fail(p.error.issues[0].message);
  if (!!p.data.agentId !== !!p.data.ramal) return fail("Preencha o agente e o ramal juntos (ou deixe os dois vazios).");
  await db.update(users).set({ vocallAgentId: p.data.agentId || null, vocallRamal: p.data.ramal || null }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou o próprio agente VocallPhone", field: me.name, newValue: p.data.agentId ? `agente ${p.data.agentId} · ramal ${p.data.ramal}` : "removido" });
  revalidatePath("/conta");
  revalidatePath("/", "layout");
  return { ok: true, message: "Agente e ramal salvos." };
}
