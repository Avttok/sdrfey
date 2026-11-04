"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, leadPeople, leads, visits } from "@/db";
import { diffToAudit, logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import { setLeadTags, type TagChange } from "@/modules/tags/apply";
import type { ActionResult } from "./actions";

const fail = (message: string): ActionResult => ({ ok: false, message });

export async function updateLeadAction(id: number, input: { company: string; tradeName: string | null; city: string | null; uf: string | null; ownerId: number | null; notes: string | null }): Promise<ActionResult> {
  const me = await requirePerm("lead.edit");
  const p = z.object({ company: z.string().trim().min(1, "Informe a razão social."), tradeName: z.string().trim().nullable(), city: z.string().trim().nullable(), uf: z.string().trim().toUpperCase().max(2).nullable(), ownerId: z.number().int().nullable(), notes: z.string().trim().nullable() }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const clean = Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, v === "" ? null : v])) as typeof p.data;
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(leads).where(eq(leads.id, id)).for("update");
    if (!b) throw new Error("Lead não encontrado.");
    await tx.update(leads).set({ ...clean, updatedAt: new Date() }).where(eq(leads.id, id));
    await logAudit(tx, diffToAudit({ userId: me.id, leadId: id, entity: "lead" }, { company: b.company, tradeName: b.tradeName, city: b.city, uf: b.uf, ownerId: b.ownerId, notes: b.notes }, clean, { company: "Razão social", tradeName: "Nome fantasia", city: "Cidade", uf: "UF", ownerId: "Responsável (id)", notes: "Observação" }));
  });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Lead salvo." };
}

export async function changeTagAction(id: number, change: { add?: TagChange[]; remove?: TagChange[] }): Promise<ActionResult> {
  const me = await requirePerm("lead.edit");
  await db.transaction(async (tx) => { await setLeadTags(tx, { leadId: id, userId: me.id, ...change }); });
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function addPersonAction(id: number, input: { name: string; roleTitle: string | null; extension: string | null }): Promise<ActionResult> {
  const me = await requirePerm("lead.edit");
  const name = input.name.trim();
  if (!name) return fail("Informe o nome da pessoa.");
  await db.insert(leadPeople).values({ leadId: id, name, roleTitle: input.roleTitle?.trim() || null, extension: input.extension?.trim() || null });
  await logAudit(db, { userId: me.id, leadId: id, entity: "lead", action: "adicionou pessoa", field: "Pessoas", newValue: name });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Pessoa adicionada." };
}
export async function removePersonAction(id: number, personId: number): Promise<ActionResult> {
  const me = await requirePerm("lead.edit");
  const [p] = await db.select().from(leadPeople).where(and(eq(leadPeople.id, personId), eq(leadPeople.leadId, id)));
  if (!p) return fail("Pessoa não encontrada.");
  await db.delete(leadPeople).where(eq(leadPeople.id, personId));
  await logAudit(db, { userId: me.id, leadId: id, entity: "lead", action: "removeu pessoa", field: "Pessoas", oldValue: p.name });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Pessoa removida." };
}

export async function cancelVisitAction(id: number, code: string): Promise<ActionResult> {
  const me = await requirePerm("lead.edit");
  await db.update(visits).set({ canceledAt: new Date() }).where(and(eq(visits.leadId, id), eq(visits.code, code)));
  await logAudit(db, { userId: me.id, leadId: id, entity: "visit", action: "cancelou visita", field: "Agenda", oldValue: code, newValue: "cancelada" });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Visita cancelada." };
}

/** Gestor/Adm libera um lead que ficou preso com alguém. */
export async function forceReleaseAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("lead.release");
  const [b] = await db.select({ by: leads.lockedBy }).from(leads).where(eq(leads.id, id));
  await db.update(leads).set({ lockedBy: null, lockedAt: null }).where(eq(leads.id, id));
  await logAudit(db, { userId: me.id, leadId: id, entity: "lead", action: "liberou o lead", field: "Em atendimento por", oldValue: b?.by ?? null, newValue: null });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Lead liberado." };
}
