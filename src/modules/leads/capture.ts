"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leadChannels, leadPeople, leads } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";

export type CapturedChannel = { id: number; personId: number | null; kind: "phone" | "email"; value: string; label: string | null; origin: "manual"; wrong: false };
export type CapturedPerson = { id: number; name: string; roleTitle: string | null; extension: string | null };
export type CaptureResult = { ok: boolean; message?: string; person?: CapturedPerson; channels?: CapturedChannel[] };

const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);

/**
 * Anota um contato durante a ligação: a pessoa (nome e cargo), o e-mail e os telefones dela, tudo de uma vez.
 * Com `personId`, acrescenta e-mail/telefones/cargo a uma pessoa que já existe. Repetidos são ignorados.
 */
export async function captureContactAction(leadId: number, input: { personId?: number | null; name?: string; roleTitle?: string; email?: string; phones?: string[] }): Promise<CaptureResult> {
  const me = await requireUser();
  const name = clip(input.name, 120);
  const roleTitle = clip(input.roleTitle, 80) || null;
  const email = clip(input.email, 160).toLowerCase();
  const phones = [...new Set((input.phones ?? []).map((p) => p.replace(/\D/g, "")).filter(Boolean))].slice(0, 5);
  if (!input.personId && !name) return { ok: false, message: "Informe o nome da pessoa." };
  if (!email && !phones.length && !input.personId && !name) return { ok: false, message: "Nada para anotar." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "E-mail inválido." };
  if (phones.some((p) => p.length < 10 || p.length > 11)) return { ok: false, message: "Telefone inválido: use DDD + número." };
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId));
  if (!lead) return { ok: false, message: "Lead não encontrado." };

  const out = await db.transaction(async (tx) => {
    let person: CapturedPerson;
    if (input.personId) {
      const [p] = await tx.select().from(leadPeople).where(and(eq(leadPeople.id, input.personId), eq(leadPeople.leadId, leadId)));
      if (!p) throw new Error("Pessoa não encontrada.");
      if (roleTitle && !p.roleTitle) await tx.update(leadPeople).set({ roleTitle }).where(eq(leadPeople.id, p.id));
      person = { id: p.id, name: p.name, roleTitle: p.roleTitle ?? roleTitle, extension: p.extension };
    } else {
      const [p] = await tx.insert(leadPeople).values({ leadId, name, roleTitle }).returning();
      await logAudit(tx, { userId: me.id, leadId, entity: "lead", action: "adicionou pessoa", field: "Pessoas", newValue: roleTitle ? `${name} (${roleTitle})` : name });
      person = { id: p.id, name: p.name, roleTitle: p.roleTitle, extension: p.extension };
    }
    const channels: CapturedChannel[] = [];
    const add = async (kind: "phone" | "email", value: string) => {
      const [c] = await tx.insert(leadChannels).values({ leadId, personId: person.id, kind, value, origin: "manual" }).onConflictDoNothing().returning();
      if (c) {
        channels.push({ id: c.id, personId: person.id, kind, value, label: c.label, origin: "manual", wrong: false });
        await logAudit(tx, { userId: me.id, leadId, entity: "lead", action: kind === "phone" ? "adicionou telefone" : "adicionou e-mail", field: kind === "phone" ? "Telefones" : "E-mails", newValue: value, meta: { pessoa: person.name } });
      } else {
        // já existia no lead: liga à pessoa só se ainda não tinha dono
        await tx.update(leadChannels).set({ personId: person.id }).where(and(eq(leadChannels.leadId, leadId), eq(leadChannels.kind, kind), eq(leadChannels.value, value), isNull(leadChannels.personId)));
      }
    };
    for (const p of phones) await add("phone", p);
    if (email) await add("email", email);
    return { person, channels };
  });
  revalidatePath("/atender");
  return { ok: true, message: "Contato anotado.", ...out };
}

/** Corrige o nome de um contato do lead (nome digitado errado durante a ligação). */
export async function renamePersonAction(leadId: number, personId: number, nameRaw: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const name = clip(nameRaw, 120);
  if (!name) return { ok: false, message: "Informe o nome." };
  const [p] = await db.select().from(leadPeople).where(and(eq(leadPeople.id, personId), eq(leadPeople.leadId, leadId)));
  if (!p) return { ok: false, message: "Contato não encontrado." };
  if (p.name === name) return { ok: true };
  await db.transaction(async (tx) => {
    await tx.update(leadPeople).set({ name }).where(eq(leadPeople.id, p.id));
    await logAudit(tx, { userId: me.id, leadId, entity: "lead", action: "corrigiu nome de pessoa", field: "Pessoas", oldValue: p.name, newValue: name });
  });
  revalidatePath("/atender");
  return { ok: true };
}
