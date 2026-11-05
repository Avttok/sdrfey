import { asc, eq } from "drizzle-orm";
import { db, emailTemplates, leadChannels, leadPeople, leads, leadTags, tagGroups, tags, visits } from "@/db";
import { mergeInfo, parseBrasilApi, parseReceitaWs } from "@/modules/enrich/parse";
import { nearestRep } from "@/modules/reps/nearest";

export type TagView = { id: number; groupKey: string; key: string; label: string; color: string };
export type TagCatalog = { key: string; name: string; exclusive: boolean; tags: (TagView & { autoOnly: boolean })[] }[];

export async function getTagCatalog(): Promise<TagCatalog> {
  const groups = await db.select().from(tagGroups).orderBy(asc(tagGroups.sort));
  const all = await db.select().from(tags).where(eq(tags.active, true)).orderBy(asc(tags.sort), asc(tags.label));
  return groups.map((g) => ({
    key: g.key,
    name: g.name,
    exclusive: g.exclusive,
    tags: all.filter((t) => t.groupKey === g.key).map((t) => ({ id: t.id, groupKey: t.groupKey, key: t.key, label: t.label, color: t.color, autoOnly: t.autoOnly })),
  }));
}

/** Tudo que a tela de atendimento e o editor do lead precisam, já em formato simples (serializável). */
export async function getLeadView(leadId: number) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return null;
  const [tagRows, channels, people, visitRows] = await Promise.all([
    db.select({ id: tags.id, groupKey: tags.groupKey, key: tags.key, label: tags.label, color: tags.color }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).innerJoin(tagGroups, eq(tagGroups.key, tags.groupKey)).where(eq(leadTags.leadId, leadId)).orderBy(asc(tagGroups.sort), asc(tags.sort), asc(tags.label)),
    db.select().from(leadChannels).where(eq(leadChannels.leadId, leadId)).orderBy(asc(leadChannels.id)),
    db.select().from(leadPeople).where(eq(leadPeople.leadId, leadId)).orderBy(asc(leadPeople.id)),
    db.select().from(visits).where(eq(visits.leadId, leadId)).orderBy(asc(visits.id)),
  ]);
  const info = mergeInfo(parseBrasilApi(lead.brasilApiData), parseReceitaWs(lead.receitaWsData));
  const rep = await nearestRep(lead.city, lead.uf);
  return {
    id: lead.id,
    cnpj: lead.cnpj,
    company: lead.company,
    tradeName: lead.tradeName ?? info?.tradeName ?? null,
    city: lead.city,
    uf: lead.uf,
    registrationStatus: lead.registrationStatus,
    notes: lead.notes,
    legacyVisit: lead.legacyVisit,
    ownerId: lead.ownerId,
    lockedBy: lead.lockedBy,
    isTest: lead.isTest,
    enrichedAt: lead.enrichedAt?.toISOString() ?? null,
    info,
    brasilApi: lead.brasilApiData ?? null,
    receitaWs: lead.receitaWsData ?? null,
    tags: tagRows,
    channels: channels.map((c) => ({ id: c.id, personId: c.personId, kind: c.kind, value: c.value, label: c.label, origin: c.origin, wrong: c.wrong })),
    people: people.map((p) => ({ id: p.id, name: p.name, roleTitle: p.roleTitle, extension: p.extension })),
    visits: visitRows.map((v) => ({ code: v.code, at: v.createdAt.toISOString(), canceled: !!v.canceledAt })),
    rep,
  };
}
export type LeadView = NonNullable<Awaited<ReturnType<typeof getLeadView>>>;

export async function getActiveTemplates() {
  return db.select({ id: emailTemplates.id, name: emailTemplates.name, subject: emailTemplates.subject, body: emailTemplates.body }).from(emailTemplates).where(eq(emailTemplates.active, true)).orderBy(asc(emailTemplates.sort), asc(emailTemplates.id));
}
