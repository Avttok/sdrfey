"use server";

import { cleanVisitLink, repSnapshot, resetLead } from "@/modules/leads/attend";
import { nearestRep } from "@/modules/reps/nearest";
import { and, eq } from "drizzle-orm";
import { hasSellerPart } from "@/config/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notify } from "@/modules/notifications/notify";
import { db, leadPeople, leads, visits } from "@/db";
import { diffToAudit, logAudit } from "@/modules/audit/log";
import { requirePerm, requireUser } from "@/modules/auth/guard";
import { leadEditor } from "./access";
import { setLeadTags, type TagChange } from "@/modules/tags/apply";
import type { ActionResult } from "./actions";

const fail = (message: string): ActionResult => ({ ok: false, message });

export async function updateLeadAction(id: number, input: { company: string; tradeName: string | null; city: string | null; uf: string | null; ownerId: number | null; notes: string | null }): Promise<ActionResult> {
  const me = await leadEditor(id);
  if (!me) return fail("Sem permissão para editar este lead.");
  const p = z.object({ company: z.string().trim().min(1, "Informe a razão social."), tradeName: z.string().trim().nullable(), city: z.string().trim().nullable(), uf: z.string().trim().toUpperCase().max(2).nullable(), ownerId: z.number().int().nullable(), notes: z.string().trim().nullable() }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const clean = Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, v === "" ? null : v])) as typeof p.data;
  const fullEdit = !!me.permissions["lead.edit"];
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(leads).where(eq(leads.id, id)).for("update");
    if (!b) throw new Error("Lead não encontrado.");
    if (!fullEdit) clean.ownerId = b.ownerId; // vendedor não troca o responsável
    await tx.update(leads).set({ ...clean, updatedAt: new Date() }).where(eq(leads.id, id));
    await logAudit(tx, diffToAudit({ userId: me.id, leadId: id, entity: "lead" }, { company: b.company, tradeName: b.tradeName, city: b.city, uf: b.uf, ownerId: b.ownerId, notes: b.notes }, clean, { company: "Razão social", tradeName: "Nome fantasia", city: "Cidade", uf: "UF", ownerId: "Responsável (id)", notes: "Observação" }));
  });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Lead salvo." };
}

/** As tags do perfil são só leitura: nascem dos atendimentos (Finalizar) e das consultas automáticas. */
export async function changeTagAction(_id: number, _change: { add?: TagChange[]; remove?: TagChange[] }): Promise<ActionResult> {
  await requirePerm("lead.edit");
  return fail("As tags não são editadas aqui: elas vão sendo geradas conforme o lead é atendido.");
}

export async function addPersonAction(id: number, input: { name: string; roleTitle: string | null; extension: string | null }): Promise<ActionResult> {
  const me = await leadEditor(id);
  if (!me) return fail("Sem permissão para editar este lead.");
  const name = input.name.trim();
  if (!name) return fail("Informe o nome da pessoa.");
  await db.insert(leadPeople).values({ leadId: id, name, roleTitle: input.roleTitle?.trim() || null, extension: input.extension?.trim() || null });
  await logAudit(db, { userId: me.id, leadId: id, entity: "lead", action: "adicionou pessoa", field: "Pessoas", newValue: name });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Pessoa adicionada." };
}
export async function setPersonStatusAction(id: number, personId: number, status: "ativo" | "saiu" | "invalido"): Promise<ActionResult> {
  const me = await leadEditor(id);
  if (!me) return fail("Sem permissão para editar este lead.");
  if (!["ativo", "saiu", "invalido"].includes(status)) return fail("Situação inválida.");
  const [p] = await db.select().from(leadPeople).where(and(eq(leadPeople.id, personId), eq(leadPeople.leadId, id)));
  if (!p) return fail("Pessoa não encontrada.");
  await db.update(leadPeople).set({ status }).where(eq(leadPeople.id, personId));
  await logAudit(db, { userId: me.id, leadId: id, entity: "lead", action: "mudou situação do contato", field: p.name, oldValue: p.status, newValue: status });
  revalidatePath(`/leads/${id}`);
  const label = status === "saiu" ? "marcado como “não trabalha mais lá”. Cadastre quem assumiu o lugar." : status === "invalido" ? "marcado com contato inválido." : "voltou a ficar ativo.";
  return { ok: true, message: `${p.name} ${label}` };
}
export async function removePersonAction(id: number, personId: number): Promise<ActionResult> {
  const me = await leadEditor(id);
  if (!me) return fail("Sem permissão para editar este lead.");
  const [p] = await db.select().from(leadPeople).where(and(eq(leadPeople.id, personId), eq(leadPeople.leadId, id)));
  if (!p) return fail("Pessoa não encontrada.");
  await db.delete(leadPeople).where(eq(leadPeople.id, personId));
  await logAudit(db, { userId: me.id, leadId: id, entity: "lead", action: "removeu pessoa", field: "Pessoas", oldValue: p.name });
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Pessoa removida." };
}

/** Quem agendou a visita (ou quem pode editar qualquer lead) pode alterá-la ou apagá-la. */
async function visitForEditing(leadId: number, visitId: number) {
  const me = await requireUser();
  const [v] = await db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.leadId, leadId)));
  if (!v) return { me, v: null, allowed: false };
  return { me, v, allowed: v.userId === me.id || !!me.permissions["lead.edit"] || (v.kind === "seller" && hasSellerPart(me.roles)) };
}

/** Apaga o registro de uma visita (fica no Registro de atividades). */
export async function deleteVisitAction(leadId: number, visitId: number): Promise<ActionResult> {
  const { me, v, allowed } = await visitForEditing(leadId, visitId);
  if (!v) return fail("Visita não encontrada.");
  if (!allowed) return fail("Só quem agendou a visita (ou quem pode editar leads) pode apagá-la.");
  await db.transaction(async (tx) => {
    await tx.delete(visits).where(eq(visits.id, visitId));
    await logAudit(tx, { userId: me.id, leadId, entity: "visit", action: "apagou visita", field: "Agenda", oldValue: v.code, newValue: null, meta: { dataDaVisita: v.visitDate } });
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visitas");
  return { ok: true, message: "Visita apagada." };
}

const visitInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^V-\d{3,}$/, "Código da visita inválido. Exemplo: V-12345."),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da visita."),
  link: z.string().trim().nullish(),
});

/** Registra uma visita na página do lead (um lead pode ter várias). Guarda o representante mais próximo e os km. */
export async function addVisitAction(leadId: number, input: { code: string; visitDate: string; link?: string | null }): Promise<ActionResult> {
  const me = await requirePerm("tab.leads");
  const p = visitInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const link = cleanVisitLink(p.data.link);
  if (p.data.link && !link) return fail("O link da visita precisa começar com https://.");
  const [lead] = await db.select({ city: leads.city, uf: leads.uf }).from(leads).where(eq(leads.id, leadId));
  if (!lead) return fail("Lead não encontrado.");
  const rep = await nearestRep(lead.city, lead.uf);
  await db.transaction(async (tx) => {
    await tx.insert(visits).values({ leadId, userId: me.id, code: p.data.code, visitDate: p.data.visitDate, link, ...repSnapshot(rep) });
    await logAudit(tx, { userId: me.id, leadId, entity: "visit", action: "agendou visita", field: "Agenda", oldValue: null, newValue: p.data.code, meta: { dataDaVisita: p.data.visitDate, representante: rep?.repName ?? null, km: rep?.km ?? null } });
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visitas");
  return { ok: true, message: "Visita registrada." };
}

/** Edita código, data, link e observação de uma visita. */
export async function updateVisitAction(leadId: number, visitId: number, input: { code: string; visitDate: string; link?: string | null; note?: string | null; isPublic?: boolean }): Promise<ActionResult> {
  const { me, v, allowed } = await visitForEditing(leadId, visitId);
  if (!v) return fail("Visita não encontrada.");
  if (!allowed) return fail("Só quem agendou a visita (ou quem pode editar leads) pode alterá-la.");
  const p = visitInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const note = input.note === undefined ? v.note : (input.note ?? "").trim().slice(0, 1000) || null;
  const link = cleanVisitLink(p.data.link);
  if (p.data.link && !link) return fail("O link da visita precisa começar com https://.");
  await db.transaction(async (tx) => {
    await tx.update(visits).set({ code: p.data.code, visitDate: p.data.visitDate, link, note, ...(typeof input.isPublic === "boolean" ? { isPublic: input.isPublic } : {}) }).where(eq(visits.id, visitId));
    await logAudit(tx, diffToAudit({ userId: me.id, leadId, entity: "visit", meta: { visita: v.code } }, { code: v.code, visitDate: v.visitDate, link: v.link, note: v.note } as Record<string, unknown>, { code: p.data.code, visitDate: p.data.visitDate, link, note } as Record<string, unknown>, { code: "Código da visita", visitDate: "Data da visita", link: "Link da visita" }));
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visitas");
  return { ok: true, message: "Visita atualizada." };
}

/** Confirmação da visita pelo representante: pendente → confirmada → realizada (ou volta a pendente). */
export async function setVisitStatusAction(leadId: number, visitId: number, status: "pendente" | "confirmada" | "realizada"): Promise<ActionResult> {
  const { me, v, allowed } = await visitForEditing(leadId, visitId);
  if (!v) return fail("Visita não encontrada.");
  if (!allowed) return fail("Só quem agendou a visita (ou quem pode editar leads) pode alterar o andamento.");
  if (v.canceledAt) return fail("Esta visita foi cancelada.");
  if (!["pendente", "confirmada", "realizada"].includes(status)) return fail("Andamento inválido.");
  if (v.status === status) return { ok: true };
  await db.transaction(async (tx) => {
    await tx.update(visits).set({ status, confirmedAt: status === "pendente" ? null : v.confirmedAt ?? new Date(), confirmedBy: status === "pendente" ? null : v.confirmedBy ?? me.id }).where(eq(visits.id, visitId));
    await logAudit(tx, { userId: me.id, leadId, entity: "visit", action: "alterou", field: "Andamento da visita", oldValue: v.status, newValue: status, meta: { visita: v.code } });
  });
  if (v.userId && v.userId !== me.id && status !== "pendente") await notify(v.userId, { kind: "visita", title: status === "confirmada" ? "Visita confirmada" : "Visita realizada", body: v.code, href: `/leads/${leadId}` });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/visitas");
  revalidatePath("/painel");
  return { ok: true, message: status === "confirmada" ? "Visita confirmada." : status === "realizada" ? "Visita marcada como realizada." : "Visita voltou a aguardar confirmação." };
}

/** Zera o atendimento do lead (tags, observação, interações e visitas) pela página do lead. */
export async function resetLeadFromPageAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("lead.edit");
  try { await resetLead(me.id, id, { fromLeadPage: true }); }
  catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Não foi possível resetar." }; }
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  return { ok: true, message: "Lead resetado: tags, observação, interações e visitas apagadas." };
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
