import { inArray, sql } from "drizzle-orm";
import { db, leadChannels, leadPeople, leads, leadTags, tagGroups, tags, users, type Db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import type { LeadDraft, TagRef } from "./leads-parse";
import { stripAccents } from "./normalize";

export type ApplyResult = {
  inserted: number;
  skippedExisting: number;
  newTags: string[];
  unknownOwners: string[];
  unknownTags: string[];
  /** Importando como inativo: clientes que já existiam como lead novo e passaram para inativo. */
  converted: number;
  /** Já cadastrados que receberam alguma informação nova da planilha. */
  enriched: number;
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Grava os leads limpos no banco. Leads novos entram inteiros; os que já existem só recebem
 * o que a planilha traz de novo (campo vazio preenchido, telefone/e-mail/contato/tag que faltavam). Nada é sobrescrito. Tudo acontece numa única transação.
 */
export async function applyLeadDrafts(
  drafts: LeadDraft[],
  opts: { importedBy: number | null; sourceName: string; kind?: "prospect" | "inativo"; batchId?: number },
  database: Db = db,
): Promise<ApplyResult> {
  return database.transaction(async (tx) => {
    const result: ApplyResult = { inserted: 0, skippedExisting: 0, newTags: [], unknownOwners: [], unknownTags: [], converted: 0, enriched: 0 };
    const kind = opts.kind ?? "prospect";

    /* 1. descobrir o que já existe */
    const existing = new Set<string>();
    for (const part of chunk(drafts.map((d) => d.cnpj), 5000)) {
      const rows = await tx.select({ cnpj: leads.cnpj }).from(leads).where(inArray(leads.cnpj, part));
      rows.forEach((r) => existing.add(r.cnpj));
    }
    const fresh = drafts.filter((d) => !existing.has(d.cnpj));
    result.skippedExisting = drafts.length - fresh.length;
    if (kind === "inativo" && existing.size) {
      /* cliente que já estava na base como lead novo, sem negociação aberta nem atendimento em andamento, passa a inativo */
      const have = drafts.filter((d) => existing.has(d.cnpj)).map((d) => d.cnpj);
      for (const part of chunk(have, 2000)) {
        const done = await tx.execute<{ id: number }>(sql`update leads set kind = 'inativo', updated_at = now()
          where cnpj in (${sql.join(part.map((c) => sql`${c}`), sql`, `)}) and kind = 'prospect' and locked_by is null
            and not exists (select 1 from deals d where d.lead_id = leads.id and d.stage not in ('ganho','perdido')) returning id`);
        result.converted += done.length;
      }
    }
    const old = drafts.filter((d) => existing.has(d.cnpj));
    if (old.length) result.enriched = await enrichExisting(tx, old, opts);
    if (fresh.length === 0) return result;

    /* 2. garantir que todas as tags citadas existem (porte e capital nascem aqui) */
    const groups = new Set((await tx.select({ key: tagGroups.key }).from(tagGroups)).map((g) => g.key));
    const tagRows = await tx.select().from(tags);
    const tagId = new Map(tagRows.map((t) => [`${t.groupKey}:${t.key}`, t.id]));

    const wanted = new Map<string, TagRef>();
    for (const d of fresh) for (const t of d.tags) wanted.set(`${t.group}:${t.key}`, t);

    for (const [k, ref] of wanted) {
      if (tagId.has(k)) continue;
      if (!groups.has(ref.group)) {
        result.unknownTags.push(k);
        continue;
      }
      const [created] = await tx
        .insert(tags)
        .values({ groupKey: ref.group, key: ref.key, label: ref.label ?? ref.key, sort: ref.sort ?? 0 })
        .returning({ id: tags.id });
      tagId.set(k, created.id);
      result.newTags.push(k);
    }

    /* 3. resolver responsáveis pelo primeiro nome */
    const userRows = await tx.select({ id: users.id, name: users.name, username: users.username }).from(users);
    const ownerId = new Map<string, number>();
    for (const u of userRows) {
      const first = stripAccents(u.name).split(" ")[0].toUpperCase();
      ownerId.set(first, u.id);
      ownerId.set(u.username.split(".")[0].toUpperCase(), u.id);
    }

    /* 4. inserir leads */
    const unknownOwners = new Set<string>();
    for (const part of chunk(fresh, 500)) {
      const inserted = await tx
        .insert(leads)
        .values(
          part.map((d) => {
            const owner = d.ownerName ? ownerId.get(stripAccents(d.ownerName)) ?? null : null;
            if (d.ownerName && owner === null) unknownOwners.add(d.ownerName);
            return {
              cnpj: d.cnpj,
              company: d.company,
              sapCode: d.sapCode,
              contactName: d.contactName,
              roleTitle: d.roleTitle,
              phones: d.phones,
              email: d.email,
              notes: d.notes,
              legacyVisit: d.legacyVisit,
              ownerId: owner,
              timesServed: d.timesServed,
              timesWorked: d.timesWorked,
              source: opts.sourceName,
              importBatchId: opts.batchId ?? null,
              kind,
              ...(d.updatedAt ? { updatedAt: d.updatedAt } : {}),
            };
          }),
        )
        .returning({ id: leads.id, cnpj: leads.cnpj });

      const idByCnpj = new Map(inserted.map((r) => [r.cnpj, r.id]));
      const tagLinks = part.flatMap((d) =>
        d.tags.flatMap((t) => {
          const id = tagId.get(`${t.group}:${t.key}`);
          return id ? [{ leadId: idByCnpj.get(d.cnpj)!, tagId: id, source: "import" as const, appliedBy: opts.importedBy }] : [];
        }),
      );
      for (const links of chunk(tagLinks, 2000)) await tx.insert(leadTags).values(links);

      /* telefones e e-mails viram canais; o contato da planilha vira uma pessoa */
      const channels = part.flatMap((d) => {
        const leadId = idByCnpj.get(d.cnpj)!;
        return [
          ...d.phones.map((value) => ({ leadId, kind: "phone" as const, value, origin: "import" as const })),
          ...(d.email ? [{ leadId, kind: "email" as const, value: d.email, origin: "import" as const }] : []),
        ];
      });
      for (const rows of chunk(channels, 2000)) await tx.insert(leadChannels).values(rows).onConflictDoNothing();
      const people = part.flatMap((d) =>
        d.contactName ? [{ leadId: idByCnpj.get(d.cnpj)!, name: d.contactName, roleTitle: d.roleTitle }] : [],
      );
      for (const rows of chunk(people, 2000)) await tx.insert(leadPeople).values(rows);

      await logAudit(
        tx,
        inserted.map((r) => ({
          userId: opts.importedBy,
          leadId: r.id,
          entity: "lead" as const,
          action: "importado",
          meta: { arquivo: opts.sourceName },
        })),
      );
      result.inserted += inserted.length;
    }
    result.unknownOwners = [...unknownOwners];
    return result;
  });
}

/** Para quem já está cadastrado: acrescenta só a informação nova e ignora o que é igual ou veio vazio. */
async function enrichExisting(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], drafts: LeadDraft[], opts: { importedBy: number | null; sourceName: string }): Promise<number> {
  let touched = 0;
  const tagRows = await tx.select().from(tags);
  const tagId = new Map(tagRows.map((t) => [`${t.groupKey}:${t.key}`, t.id]));
  for (const part of chunk(drafts, 300)) {
    const rows = await tx.select().from(leads).where(inArray(leads.cnpj, part.map((d) => d.cnpj)));
    const byCnpj = new Map(rows.map((r) => [r.cnpj, r]));
    const ids = rows.map((r) => r.id);
    const [people, have] = ids.length ? await Promise.all([
      tx.select({ leadId: leadPeople.leadId, name: leadPeople.name }).from(leadPeople).where(inArray(leadPeople.leadId, ids)),
      tx.select({ leadId: leadTags.leadId, tagId: leadTags.tagId }).from(leadTags).where(inArray(leadTags.leadId, ids)),
    ]) : [[], []];
    const norm = (x: string) => stripAccents(x).trim().toUpperCase();
    const personKeys = new Set(people.map((p) => `${p.leadId}|${norm(p.name)}`));
    const tagKeys = new Set(have.map((h) => `${h.leadId}|${h.tagId}`));
    const audits: Parameters<typeof logAudit>[1] = [];
    for (const d of part) {
      const l = byCnpj.get(d.cnpj);
      if (!l) continue;
      const fill: Partial<typeof leads.$inferInsert> = {};
      const added: string[] = [];
      if (d.sapCode && !l.sapCode) { fill.sapCode = d.sapCode; added.push("Código SAP"); }
      if (d.contactName && !l.contactName) { fill.contactName = d.contactName; added.push("Contato"); }
      if (d.roleTitle && !l.roleTitle) { fill.roleTitle = d.roleTitle; added.push("Cargo"); }
      if (d.email && !l.email) { fill.email = d.email; added.push("E-mail"); }
      if (d.notes && !l.notes) { fill.notes = d.notes; added.push("Observações"); }
      if (d.legacyVisit && !l.legacyVisit) { fill.legacyVisit = d.legacyVisit; added.push("Visita anterior"); }
      if (l.company.startsWith("CNPJ ") && d.company && !d.company.startsWith("CNPJ ")) { fill.company = d.company; added.push("Nome da empresa"); }
      const newPhones = d.phones.filter((p) => !l.phones.includes(p));
      if (newPhones.length) { fill.phones = [...l.phones, ...newPhones]; added.push(`${newPhones.length} telefone(s)`); }
      for (const ph of newPhones) await tx.insert(leadChannels).values({ leadId: l.id, kind: "phone", value: ph, origin: "import" }).onConflictDoNothing();
      if (d.email) await tx.insert(leadChannels).values({ leadId: l.id, kind: "email", value: d.email, origin: "import" }).onConflictDoNothing();
      if (d.contactName && !personKeys.has(`${l.id}|${norm(d.contactName)}`)) { await tx.insert(leadPeople).values({ leadId: l.id, name: d.contactName, roleTitle: d.roleTitle }); personKeys.add(`${l.id}|${norm(d.contactName)}`); if (!added.includes("Contato")) added.push("Pessoa de contato"); }
      const links = d.tags.flatMap((t) => { const id = tagId.get(`${t.group}:${t.key}`); return id && !tagKeys.has(`${l.id}|${id}`) ? [{ leadId: l.id, tagId: id, source: "import" as const, appliedBy: opts.importedBy }] : []; });
      if (links.length) { await tx.insert(leadTags).values(links); added.push(`${links.length} tag(s)`); }
      if (!added.length) continue;
      if (Object.keys(fill).length) await tx.update(leads).set({ ...fill, updatedAt: new Date() }).where(inArray(leads.id, [l.id]));
      audits.push({ userId: opts.importedBy, leadId: l.id, entity: "lead" as const, action: "completado pela importação", field: added.join(", "), meta: { arquivo: opts.sourceName } });
      touched++;
    }
    if (audits.length) await logAudit(tx, audits);
  }
  return touched;
}

/** Quantos já cadastrados receberiam informação nova (simulação: roda a mesma lógica e desfaz). */
export async function countEnrichable(drafts: LeadDraft[]): Promise<number> {
  let n = 0;
  const cnpjs = new Set<string>();
  for (const part of chunk(drafts.map((d) => d.cnpj), 5000)) (await db.select({ cnpj: leads.cnpj }).from(leads).where(inArray(leads.cnpj, part))).forEach((r) => cnpjs.add(r.cnpj));
  const old = drafts.filter((d) => cnpjs.has(d.cnpj));
  if (!old.length) return 0;
  try {
    await db.transaction(async (tx) => { n = await enrichExisting(tx, old, { importedBy: null, sourceName: "simulação" }); tx.rollback(); });
  } catch { /* rollback intencional */ }
  return n;
}
