"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { contactEvents, db, leadChannels, leadPeople, leads, tasks } from "@/db";
import { dueFromDays } from "@/config/tasks";
import { CHANNELS, isTouchChannel, outcomeOf, validOutcome, type TouchChannel } from "@/config/touches";
import { logAudit } from "@/modules/audit/log";
import { getCurrentUser } from "@/modules/auth/guard";

const norm = (channel: TouchChannel, target: string) => (channel === "email" ? target.trim().toLowerCase() : target.replace(/\D/g, ""));

/** Anota que a pessoa ligou / mandou WhatsApp / mandou e-mail. Fica "em aberto" até ela dizer como foi. */
export async function startTouchAction(input: { leadId: number; channel: string; target: string; personId?: number | null; runId?: string | null }): Promise<{ ok: true; id: number } | { ok: false }> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !Number.isInteger(input?.leadId) || !isTouchChannel(input.channel)) return { ok: false };
  const target = norm(input.channel, String(input.target ?? ""));
  if (target.length < 5) return { ok: false };
  const [lead] = await db.select({ id: leads.id, isTest: leads.isTest }).from(leads).where(eq(leads.id, input.leadId));
  if (!lead) return { ok: false };
  const [row] = await db.insert(contactEvents).values({ leadId: lead.id, userId: me.id, channel: input.channel, target, personId: input.personId ?? null, runId: input.runId ?? null, isTest: lead.isTest }).returning({ id: contactEvents.id });
  return { ok: true, id: row.id };
}

export type ResolveInput = { id: number; outcome: string; personId?: number | null; note?: string | null; durationSec?: number | null; retryDays?: number | null };

/** Registra como foi. Número errado / sem WhatsApp / e-mail que voltou marcam o canal como inválido; falar com alguém confirma a pessoa. */
export async function resolveTouchAction(input: ResolveInput): Promise<{ ok: boolean; message?: string }> {
  const me = await getCurrentUser();
  if (!me || !Number.isInteger(input?.id)) return { ok: false, message: "Entre de novo." };
  const [ev] = await db.select().from(contactEvents).where(eq(contactEvents.id, input.id));
  if (!ev || ev.userId !== me.id) return { ok: false, message: "Contato não encontrado." };
  const channel = ev.channel as TouchChannel;
  if (!validOutcome(channel, input.outcome)) return { ok: false, message: "Resultado inválido." };
  const o = outcomeOf(channel, input.outcome)!;
  const personId = o.reached ? input.personId ?? ev.personId ?? null : input.personId ?? ev.personId ?? null;
  await db.transaction(async (tx) => {
    await tx.update(contactEvents).set({ outcome: input.outcome, personId, note: input.note?.trim().slice(0, 300) || null, durationSec: input.durationSec ?? ev.durationSec, resolvedAt: new Date() }).where(eq(contactEvents.id, ev.id));
    if (o.wrong) {
      const kind = channel === "email" ? "email" : "phone";
      const r = await tx.update(leadChannels).set({ wrong: true }).where(and(eq(leadChannels.leadId, ev.leadId), eq(leadChannels.kind, kind), eq(leadChannels.value, ev.target))).returning({ id: leadChannels.id });
      if (r.length) await logAudit(tx, { userId: me.id, leadId: ev.leadId, entity: "lead", action: "marcou como inválido", field: kind === "email" ? "E-mail" : "Telefone", oldValue: ev.target, newValue: o.label });
    }
    if (o.reached && personId) await tx.update(leadPeople).set({ confirmedAt: new Date(), status: "ativo" }).where(and(eq(leadPeople.id, personId), eq(leadPeople.leadId, ev.leadId)));
    if (channel === "call" && o.reached) {
      // falou com o cliente: as tarefas "ligar" deste lead que eram suas estão cumpridas
      await tx.update(tasks).set({ doneAt: new Date() }).where(and(eq(tasks.userId, me.id), eq(tasks.leadId, ev.leadId), eq(tasks.kind, "ligar"), isNull(tasks.doneAt)));
    }
    if (input.retryDays && input.retryDays > 0 && !o.reached && !o.wrong) {
      const [l] = await tx.select({ company: leads.company, tradeName: leads.tradeName }).from(leads).where(eq(leads.id, ev.leadId));
      const [open] = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, me.id), eq(tasks.leadId, ev.leadId), eq(tasks.kind, channel === "call" ? "ligar" : channel === "email" ? "email" : "whatsapp"), isNull(tasks.doneAt))).limit(1);
      if (!open) await tx.insert(tasks).values({ area: "sdr", userId: me.id, leadId: ev.leadId, kind: channel === "call" ? "ligar" : channel === "email" ? "email" : "whatsapp", title: `${CHANNELS[channel].label} de novo: ${l?.tradeName || l?.company || "lead"}`, dueAt: dueFromDays(input.retryDays) });
    }
  });
  try { revalidatePath(`/leads/${ev.leadId}`); revalidatePath("/tarefas"); revalidatePath("/tarefas-vendas"); } catch { /* fora de requisição */ }
  return { ok: true };
}

/** Quantos contatos seus estão sem resultado (aparecem para resolver). */
export async function myOpenTouchesAction(): Promise<{ id: number; leadId: number; channel: TouchChannel; target: string; at: string; company: string; personId: number | null }[]> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return [];
  const rows = await db.execute<{ id: number; lead_id: number; channel: string; target: string; at: string; company: string; person_id: number | null }>(sql`
    select e.id, e.lead_id, e.channel, e.target, e.at, coalesce(l.trade_name, l.company) as company, e.person_id
    from contact_events e join leads l on l.id = e.lead_id
    where e.user_id = ${me.id} and e.outcome is null and e.at > now() - interval '2 days' order by e.at desc limit 10`);
  return rows.map((r) => ({ id: Number(r.id), leadId: Number(r.lead_id), channel: r.channel as TouchChannel, target: r.target, at: new Date(r.at).toISOString(), company: r.company, personId: r.person_id == null ? null : Number(r.person_id) }));
}

/** Descarta um contato que foi aberto por engano (não ligou de fato). */
export async function dropTouchAction(id: number): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !Number.isInteger(id)) return;
  await db.delete(contactEvents).where(and(eq(contactEvents.id, id), eq(contactEvents.userId, me.id), isNull(contactEvents.outcome)));
}

/** Liga o contato ao roteiro usado na ligação. */
export async function attachRunAction(id: number, runId: string): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !Number.isInteger(id) || !/^[\w-]{6,64}$/.test(runId)) return;
  await db.update(contactEvents).set({ runId }).where(and(eq(contactEvents.id, id), eq(contactEvents.userId, me.id)));
}

/** Quem pode ter atendido: pessoas do lead e, para o número, a pessoa ligada a ele. */
export async function touchContextAction(leadId: number, channel: string, target: string): Promise<{ people: { id: number; name: string; role: string | null }[]; linkedId: number | null }> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !Number.isInteger(leadId) || !isTouchChannel(channel)) return { people: [], linkedId: null };
  const people = await db.select({ id: leadPeople.id, name: leadPeople.name, role: leadPeople.roleTitle }).from(leadPeople).where(and(eq(leadPeople.leadId, leadId), eq(leadPeople.status, "ativo"))).orderBy(leadPeople.id).limit(30);
  const [c] = await db.select({ p: leadChannels.personId }).from(leadChannels).where(and(eq(leadChannels.leadId, leadId), eq(leadChannels.kind, channel === "email" ? "email" : "phone"), eq(leadChannels.value, norm(channel, target)))).limit(1);
  return { people, linkedId: c?.p ?? null };
}
