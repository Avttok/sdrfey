import { nearestRep } from "@/modules/reps/nearest";
import { and, eq, sql } from "drizzle-orm";
import { attendanceSessions, db, interactions, leadChannels, leads, leadTags, tags, visits } from "@/db";
import { TAG } from "@/config/tags";
import { diffToAudit, logAudit } from "@/modules/audit/log";
import { getSettings } from "@/modules/settings/get";
import { setLeadTags, type TagChange } from "@/modules/tags/apply";
import { createDealTx } from "@/modules/deals/handoff";
import { UserError } from "./sorter";

export type SaveInput = {
  leadId: number;
  /** Meios realmente usados (chaves do grupo "meio"): ligacao, whatsapp, email... */
  channels: string[];
  temperature?: string | null;
  qualification?: "qualificado" | "desqualificado" | null;
  /** Conjunto final de situações escolhidas pela pessoa (chaves do grupo "situacao"). */
  situations: string[];
  note?: string | null;
  /** Código da visita no Salesforce, ex.: V-12345. Agendar qualifica o lead. */
  visitCode?: string | null;
  /** Dia em que a visita vai acontecer (AAAA-MM-DD). Obrigatório junto com o código. */
  visitDate?: string | null;
  /** Link da visita no Salesforce (opcional). */
  visitLink?: string | null;
  /** Para onde o lead vai ao fim do atendimento: vendedores (negociação imediata) ou representante (visita). */
  handoff?: { to: "sellers" | "reps" | "none"; sellerId?: number | null; note?: string | null } | null;
};

const VISIT_RE = /^V-\d{3,}$/i;

/** Confere que o lead está em atendimento por esta pessoa. */
async function assertMine(tx: typeof db, userId: number, leadId: number) {
  const [l] = await tx.select().from(leads).where(eq(leads.id, leadId)).for("update");
  if (!l) throw new UserError("Lead não encontrado.");
  if (l.lockedBy !== userId) throw new UserError("Este lead não está mais com você (foi liberado por inatividade). Use ATENDER para pegá-lo de novo.");
  return l;
}

export async function saveAttendance(userId: number, input: SaveInput): Promise<void> {
  if (input.channels.length === 0) throw new UserError("Marque ao menos um meio de contato usado.");
  const toSellers = input.handoff?.to === "sellers";
  const visitCode = input.handoff?.to === "none" ? null : input.visitCode?.trim().toUpperCase() || null;
  if (visitCode && !VISIT_RE.test(visitCode)) throw new UserError("Código da visita inválido. Exemplo: V-12345.");
  const visitDate = input.visitDate && /^\d{4}-\d{2}-\d{2}$/.test(input.visitDate) ? input.visitDate : null;
  if (visitCode && !visitDate) throw new UserError("Informe a data da visita.");
  const visitLink = cleanVisitLink(input.visitLink);
  if (input.visitLink?.trim() && !visitLink) throw new UserError("O link da visita precisa começar com https://.");
  const s = await getSettings();

  await db.transaction(async (tx) => {
    const lead = await assertMine(tx as unknown as typeof db, userId, input.leadId);
    const add: TagChange[] = [];
    const remove: TagChange[] = [];

    for (const c of input.channels) add.push({ group: TAG.group.meio, key: c });
    if (input.temperature) add.push({ group: TAG.group.temperatura, key: input.temperature });
    if (input.qualification && !visitCode) add.push({ group: TAG.group.qualificacao, key: input.qualification });
    if (visitCode || toSellers) {
      add.push({ group: TAG.group.agenda, key: TAG.agendado }, { group: TAG.group.qualificacao, key: TAG.qualificado });
    }

    // situações: a pessoa define o conjunto; tags que só o sistema aplica ficam como estão
    const situ = await tx
      .select({ key: tags.key, autoOnly: tags.autoOnly })
      .from(leadTags)
      .innerJoin(tags, eq(tags.id, leadTags.tagId))
      .where(and(eq(leadTags.leadId, lead.id), eq(tags.groupKey, TAG.group.situacao)));
    for (const t of situ) if (!t.autoOnly && !input.situations.includes(t.key)) remove.push({ group: TAG.group.situacao, key: t.key });
    for (const k of input.situations) add.push({ group: TAG.group.situacao, key: k });

    await setLeadTags(tx, { leadId: lead.id, userId, add, remove });

    if (visitCode) {
      const rep = toSellers ? null : await nearestRep(lead.city, lead.uf);
      await tx.insert(visits).values({ leadId: lead.id, userId, code: visitCode, visitDate, link: visitLink, ...(toSellers ? { kind: "seller" as const, sellerId: input.handoff?.sellerId ?? null } : repSnapshot(rep)) });
      await logAudit(tx, { userId, leadId: lead.id, entity: "visit", action: "agendou visita", field: "Agenda", oldValue: null, newValue: visitCode, meta: { dataDaVisita: visitDate, modalidade: toSellers ? "Vendedores SDR" : "Representante", representante: rep?.repName ?? null, km: rep?.km ?? null } });
    }

    if (toSellers) await createDealTx(tx, { leadId: lead.id, sdrId: userId, sellerId: input.handoff?.sellerId ?? null, note: input.handoff?.note ?? input.note ?? null, isTest: lead.isTest });

    await tx.insert(interactions).values(
      input.channels.map((channel) => ({ leadId: lead.id, userId, channel, note: input.note ?? null, isTest: lead.isTest })),
    );

    // observação
    const note = input.note?.trim() || null;
    const patch: Partial<typeof lead> = {};
    if (note !== undefined && note !== lead.notes && note !== null) patch.notes = note;

    // quando volta ao sorteio
    const finalTags = await tx
      .select({ key: tags.key, cooldownDays: tags.cooldownDays, blocks: tags.blocksSorting })
      .from(leadTags)
      .innerJoin(tags, eq(tags.id, leadTags.tagId))
      .where(eq(leadTags.leadId, lead.id));
    const days = finalTags.some((t) => t.key === TAG.semContato)
      ? s.sem_contato_days
      : Math.max(s.rework_days, ...finalTags.map((t) => t.cooldownDays ?? 0));
    const next = new Date(Date.now() + days * 86400_000);

    await tx
      .update(leads)
      .set({
        ...patch,
        ownerId: lead.ownerId ?? userId,
        lockedBy: null,
        lockedAt: null,
        timesWorked: sql`${leads.timesWorked} + 1`,
        nextEligibleAt: next,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));
    if (patch.notes !== undefined) {
      await logAudit(tx, diffToAudit({ userId, leadId: lead.id, entity: "lead" }, { notes: lead.notes }, { notes: patch.notes }, { notes: "Observação" }));
    }
    if (!lead.ownerId) await logAudit(tx, { userId, leadId: lead.id, entity: "lead", action: "definiu responsável", field: "Responsável", oldValue: null, newValue: String(userId) });

    await tx
      .update(attendanceSessions)
      .set({ savedAt: new Date(), outcome: "saved", startedAt: sql`coalesce(${attendanceSessions.startedAt}, ${attendanceSessions.shownAt})` })
      .where(and(eq(attendanceSessions.userId, userId), eq(attendanceSessions.leadId, lead.id), sql`${attendanceSessions.outcome} is null`));
    await logAudit(tx, { userId, leadId: lead.id, entity: "session", action: "salvou o atendimento", meta: { meios: input.channels } });
  });
}

/** Descarta o lead (fora do sorteio). Não conta na meta. */
export async function discardLead(userId: number, leadId: number, reason?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const lead = await assertMine(tx as unknown as typeof db, userId, leadId);
    await setLeadTags(tx, { leadId, userId, add: [{ group: TAG.group.situacao, key: TAG.descartado }], reason });
    await tx.update(leads).set({ lockedBy: null, lockedAt: null }).where(eq(leads.id, lead.id));
    await tx
      .update(attendanceSessions)
      .set({ outcome: "discarded" })
      .where(and(eq(attendanceSessions.userId, userId), eq(attendanceSessions.leadId, leadId), sql`${attendanceSessions.outcome} is null`));
  });
}

/** Marca a hora em que a pessoa realmente começou (primeiro passo concluído). */
export async function markStarted(userId: number, leadId: number): Promise<void> {
  await db
    .update(attendanceSessions)
    .set({ startedAt: new Date() })
    .where(and(eq(attendanceSessions.userId, userId), eq(attendanceSessions.leadId, leadId), sql`${attendanceSessions.outcome} is null`, sql`${attendanceSessions.startedAt} is null`));
}

/** Acrescenta um telefone ou e-mail ao lead (usado no passo de contatos). */
export async function addChannel(userId: number, leadId: number, kind: "phone" | "email", raw: string, label?: string) {
  const value = kind === "phone" ? raw.replace(/\D/g, "") : raw.trim().toLowerCase();
  if (kind === "phone" && (value.length < 10 || value.length > 11)) throw new UserError("Telefone inválido: use DDD + número.");
  if (kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new UserError("E-mail inválido.");
  const inserted = await db.insert(leadChannels).values({ leadId, kind, value, label: label ?? null, origin: "manual" }).onConflictDoNothing().returning({ id: leadChannels.id });
  if (inserted.length) await logAudit(db, { userId, leadId, entity: "lead", action: kind === "phone" ? "adicionou telefone" : "adicionou e-mail", field: kind === "phone" ? "Telefones" : "E-mails", oldValue: null, newValue: value });
  return inserted.length > 0;
}

/**
 * RESETAR LEAD: apaga o que foi feito no atendimento (tags de contato, temperatura, qualificação, situação,
 * observação, interações e visitas) e devolve o lead ao estoque como novo. Os dados do lead (CNPJ, contatos,
 * consultas, porte e capital) continuam salvos. Tudo é registrado no Registro.
 */
export async function resetLead(userId: number, leadId: number, opts: { fromLeadPage?: boolean } = {}): Promise<void> {
  await db.transaction(async (tx) => {
    const lead = opts.fromLeadPage ? await loadUnlockedForReset(tx as unknown as typeof db, leadId) : await assertMine(tx as unknown as typeof db, userId, leadId);
    const current = await tx
      .select({ group: tags.groupKey, key: tags.key })
      .from(leadTags)
      .innerJoin(tags, eq(tags.id, leadTags.tagId))
      .where(eq(leadTags.leadId, leadId));
    const keep = new Set<string>([TAG.group.porte, TAG.group.capital]);
    await setLeadTags(tx, { leadId, userId, remove: current.filter((t) => !keep.has(t.group)).map((t) => ({ group: t.group, key: t.key })), reason: "Lead resetado" });
    const gone = await tx.delete(interactions).where(eq(interactions.leadId, leadId)).returning({ id: interactions.id });
    const canceled = await tx.update(visits).set({ canceledAt: new Date() }).where(and(eq(visits.leadId, leadId), sql`${visits.canceledAt} is null`)).returning({ id: visits.id });
    await tx.update(leads).set({ notes: null, returnAt: null, nextEligibleAt: null, timesWorked: 0, ownerId: null }).where(eq(leads.id, leadId));
    await logAudit(tx, {
      userId,
      leadId,
      entity: "lead",
      action: "resetou lead",
      field: "atendimento",
      oldValue: lead.notes,
      newValue: "zerado",
      meta: { interacoes: gone.length, visitasCanceladas: canceled.length, observacaoApagada: !!lead.notes },
    });
  });
}

/** Reset pela página do lead: vale para qualquer lead que não esteja sendo atendido por outra pessoa. */
async function loadUnlockedForReset(tx: typeof db, leadId: number) {
  const [lead] = await tx.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead não encontrado.");
  if (lead.lockedBy) throw new Error("Este lead está em atendimento. Libere-o antes de resetar.");
  return lead;
}

/** Link opcional da visita: precisa ser http(s) e ter até 600 caracteres. */
export function cleanVisitLink(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  return v && /^https?:\/\/\S+$/i.test(v) && v.length <= 600 ? v : null;
}

/** Guarda na visita quem era o representante mais próximo e a distância na hora do agendamento. */
export function repSnapshot(rep: Awaited<ReturnType<typeof nearestRep>>) {
  return rep ? { repName: rep.repName, repSap: rep.sapCode, repCity: rep.city && rep.uf ? `${rep.city}/${rep.uf}` : rep.city, repKm: rep.km } : { repName: null, repSap: null, repCity: null, repKm: null };
}
