import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { bubbleHex } from "@/config/theme";
import { db, emailTemplates, leadChannels, leadPeople, leads, leadTags, tagGroups, tags, users, visits } from "@/db";
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
  const [tagRows, channels, people, visitRows, rep] = await Promise.all([
    db.select({ id: tags.id, groupKey: tags.groupKey, key: tags.key, label: tags.label, color: tags.color }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).innerJoin(tagGroups, eq(tagGroups.key, tags.groupKey)).where(and(eq(leadTags.leadId, leadId), eq(tags.active, true))).orderBy(asc(tagGroups.sort), asc(tags.sort), asc(tags.label)),
    db.select().from(leadChannels).where(eq(leadChannels.leadId, leadId)).orderBy(asc(leadChannels.id)),
    db.select().from(leadPeople).where(eq(leadPeople.leadId, leadId)).orderBy(asc(leadPeople.id)),
    db.select({ id: visits.id, code: visits.code, createdAt: visits.createdAt, visitDate: visits.visitDate, link: visits.link, repName: visits.repName, repSap: visits.repSap, repCity: visits.repCity, repKm: visits.repKm, kind: visits.kind, sellerName: sql<string | null>`(select name from users su where su.id = ${visits.sellerId})`, userId: visits.userId, canceledAt: visits.canceledAt, status: visits.status, confirmedAt: visits.confirmedAt, by: users.name, byId: users.id, byAccent: users.accent, byRoles: users.roles }).from(visits).leftJoin(users, eq(users.id, visits.userId)).where(eq(visits.leadId, leadId)).orderBy(desc(visits.id)),
    nearestRep(lead.city, lead.uf),
  ]);
  const info = mergeInfo(parseBrasilApi(lead.brasilApiData), parseReceitaWs(lead.receitaWsData));
  return {
    id: lead.id,
    cnpj: lead.cnpj,
    company: lead.company,
    tradeName: lead.tradeName ?? info?.tradeName ?? null,
    city: lead.city,
    uf: lead.uf,
    registrationStatus: lead.registrationStatus,
    site: lead.site,
    instagram: lead.instagram,
    facebook: lead.facebook,
    linkedin: lead.linkedin,
    notes: lead.notes,
    legacyVisit: lead.legacyVisit,
    salesforceUrl: lead.salesforceUrl,
    eoxUrl: lead.eoxUrl,
    eoxId: lead.eoxId,
    sfId: lead.sfId,
    ownerId: lead.ownerId,
    lockedBy: lead.lockedBy,
    isTest: lead.isTest,
    enrichedAt: lead.enrichedAt?.toISOString() ?? null,
    info,
    brasilApi: lead.brasilApiData ?? null,
    receitaWs: lead.receitaWsData ?? null,
    tags: tagRows,
    channels: channels.map((c) => ({ id: c.id, personId: c.personId, kind: c.kind, value: c.value, label: c.label, origin: c.origin, wrong: c.wrong })),
    people: people.map((p) => ({ id: p.id, name: p.name, roleTitle: p.roleTitle, extension: p.extension, status: p.status })),
    visits: visitRows.map((v) => ({ id: v.id, code: v.code, at: v.createdAt.toISOString(), visitDate: v.visitDate, link: v.link, repName: v.repName, repSap: v.repSap, repCity: v.repCity, repKm: v.repKm, kind: v.kind, sellerName: v.sellerName, byUserId: v.userId, canceled: !!v.canceledAt, status: v.canceledAt ? ("cancelada" as const) : v.status, confirmedAt: v.confirmedAt?.toISOString() ?? null, by: v.by, byHex: v.by ? bubbleHex(v.byAccent, v.byId ?? 0, v.byRoles ?? undefined) : null })),
    rep,
  };
}
export type LeadView = NonNullable<Awaited<ReturnType<typeof getLeadView>>>;

/** Modelos do time (sem dono) + os pessoais de quem atende. */
export async function getActiveTemplates(userId: number) {
  return db.select({ id: emailTemplates.id, name: emailTemplates.name, subject: emailTemplates.subject, body: emailTemplates.body, bodyHtml: emailTemplates.bodyHtml }).from(emailTemplates).where(and(eq(emailTemplates.active, true), or(isNull(emailTemplates.ownerId), eq(emailTemplates.ownerId, userId)))).orderBy(asc(emailTemplates.sort), asc(emailTemplates.id));
}
