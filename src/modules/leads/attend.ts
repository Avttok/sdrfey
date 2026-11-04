import { and, eq, sql } from "drizzle-orm";
import { attendanceSessions, db, interactions, leadChannels, leads, leadTags, tags, visits } from "@/db";
import { TAG } from "@/config/tags";
import { diffToAudit, logAudit } from "@/modules/audit/log";
import { getSettings } from "@/modules/settings/get";
import { setLeadTags, type TagChange } from "@/modules/tags/apply";
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
  const visitCode = input.visitCode?.trim().toUpperCase() || null;
  if (visitCode && !VISIT_RE.test(visitCode)) throw new UserError("Código da visita inválido. Exemplo: V-12345.");
  const s = await getSettings();

  await db.transaction(async (tx) => {
    const lead = await assertMine(tx as unknown as typeof db, userId, input.leadId);
    const add: TagChange[] = [];
    const remove: TagChange[] = [];

    for (const c of input.channels) add.push({ group: TAG.group.meio, key: c });
    if (input.temperature) add.push({ group: TAG.group.temperatura, key: input.temperature });
    if (input.qualification && !visitCode) add.push({ group: TAG.group.qualificacao, key: input.qualification });
    if (visitCode) {
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
      await tx.insert(visits).values({ leadId: lead.id, userId, code: visitCode });
      await logAudit(tx, { userId, leadId: lead.id, entity: "visit", action: "agendou visita", field: "Agenda", oldValue: null, newValue: visitCode });
    }

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
