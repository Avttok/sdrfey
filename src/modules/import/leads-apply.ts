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
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Grava os leads limpos no banco. Só entram CNPJs que ainda não existem:
 * nada do que já foi trabalhado é sobrescrito. Tudo acontece numa única transação.
 */
export async function applyLeadDrafts(
  drafts: LeadDraft[],
  opts: { importedBy: number | null; sourceName: string; kind?: "prospect" | "inativo" },
  database: Db = db,
): Promise<ApplyResult> {
  return database.transaction(async (tx) => {
    const result: ApplyResult = { inserted: 0, skippedExisting: 0, newTags: [], unknownOwners: [], unknownTags: [], converted: 0 };
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
