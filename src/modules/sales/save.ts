import { and, eq, sql } from "drizzle-orm";
import { db, interactions, leads, leadTags, sellerShuffles, tags, visits } from "@/db";
import { TAG } from "@/config/tags";
import { diffToAudit, logAudit } from "@/modules/audit/log";
import { cleanVisitLink, type SaveInput } from "@/modules/leads/attend";
import { UserError } from "@/modules/leads/sorter";
import { createDealTx } from "@/modules/deals/handoff";
import { setLeadTags, type TagChange } from "@/modules/tags/apply";

export type SalesFinal = "none" | "visit" | "sdr";
const VISIT_RE = /^V-\d{3,}$/i;

/**
 * Salva o trabalho do vendedor num lead inativo (mesmos dados do atendimento do SDR: tags, meios usados, observação)
 * e dá o destino: só salvar, agendar visita (que já abre a negociação no painel Novo dele; para enviar ao painel a visita é obrigatória), ou devolver à fila de prospecção dos SDR.
 * Diferente do SDR, não manda para representante.
 */
export async function saveSalesWork(userId: number, shuffleId: number, input: SaveInput, final: SalesFinal): Promise<void> {
  const visitCode = final === "visit" ? input.visitCode?.trim().toUpperCase() || null : null;
  if (final === "visit") {
    if (!visitCode || !VISIT_RE.test(visitCode)) throw new UserError("Informe o código da visita (ex.: V-12345).");
    if (!input.visitDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)) throw new UserError("Informe a data da visita.");
  }
  const link = cleanVisitLink(input.visitLink);
  if (final === "visit" && !link) throw new UserError("Informe o link da visita no Salesforce (começando com https://).");

  await db.transaction(async (tx) => {
    const [s] = await tx.select().from(sellerShuffles).where(and(eq(sellerShuffles.id, shuffleId), eq(sellerShuffles.userId, userId), sql`${sellerShuffles.outcome} is null`)).for("update");
    if (!s) throw new UserError("Este lead não está mais com você.");
    const [lead] = await tx.select().from(leads).where(eq(leads.id, s.leadId)).for("update");
    if (!lead) throw new UserError("Lead não encontrado.");
    if (lead.lockedBy !== userId) throw new UserError("Este lead foi liberado por inatividade. Volte ao Shuffler para pegar outro.");

    const add: TagChange[] = [], remove: TagChange[] = [];
    for (const c of input.channels) add.push({ group: TAG.group.meio, key: c });
    if (input.temperature) add.push({ group: TAG.group.temperatura, key: input.temperature });
    if (input.qualification && final !== "visit") add.push({ group: TAG.group.qualificacao, key: input.qualification });
    if (final === "visit") add.push({ group: TAG.group.agenda, key: TAG.agendado }, { group: TAG.group.qualificacao, key: TAG.qualificado });
    const situ = await tx.select({ key: tags.key, autoOnly: tags.autoOnly }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).where(and(eq(leadTags.leadId, lead.id), eq(tags.groupKey, TAG.group.situacao)));
    for (const t of situ) if (!t.autoOnly && !input.situations.includes(t.key)) remove.push({ group: TAG.group.situacao, key: t.key });
    for (const k of input.situations) add.push({ group: TAG.group.situacao, key: k });
    if (add.length || remove.length) await setLeadTags(tx, { leadId: lead.id, userId, add, remove });

    if (input.channels.length) await tx.insert(interactions).values(input.channels.map((channel) => ({ leadId: lead.id, userId, channel, note: input.note ?? null, isTest: lead.isTest })));

    let dealId: number | null = null;
    if (final === "visit") {
      await tx.insert(visits).values({ leadId: lead.id, userId, code: visitCode!, visitDate: input.visitDate!, link, isPublic: !!input.visitPublic, kind: "seller" as const, sellerId: userId });
      await logAudit(tx, { userId, leadId: lead.id, entity: "visit", action: "agendou visita", field: "Agenda", oldValue: null, newValue: visitCode, meta: { dataDaVisita: input.visitDate, modalidade: "Vendedor (lead inativo)" } });
    }
    if (final === "visit") dealId = await createDealTx(tx, { leadId: lead.id, sdrId: userId, sellerId: userId, note: input.note ?? null, isTest: lead.isTest });

    const note = input.note?.trim() || null;
    const patch: Partial<typeof lead> = {};
    if (note && note !== lead.notes) patch.notes = note;
    if (final === "sdr") { patch.kind = "prospect"; patch.nextEligibleAt = new Date(); }
    await tx.update(leads).set({ ...patch, lockedBy: null, lockedAt: null, timesWorked: sql`${leads.timesWorked} + 1`, updatedAt: new Date() }).where(eq(leads.id, lead.id));
    if (patch.notes !== undefined) await logAudit(tx, diffToAudit({ userId, leadId: lead.id, entity: "lead" }, { notes: lead.notes }, { notes: patch.notes }, { notes: "Observação" }));
    if (final === "sdr") await logAudit(tx, { userId, leadId: lead.id, entity: "lead", action: "devolveu lead inativo à fila dos SDR", field: "Tipo", oldValue: "Inativo", newValue: "Prospecção" });

    await tx.update(sellerShuffles).set({ outcome: final === "visit" ? "deal" : final === "sdr" ? "to_sdr" : "saved", dealId, doneAt: new Date(), note }).where(eq(sellerShuffles.id, shuffleId));
    await logAudit(tx, { userId, leadId: lead.id, entity: "lead", action: "trabalhou lead inativo", field: "Shuffler de vendas", newValue: final, meta: { meios: input.channels } });
  });
}
