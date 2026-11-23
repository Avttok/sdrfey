"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, importBatches, importUndo, leadChannels, leadPeople, leads } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { roleKindOf } from "@/modules/facts/contacts";
import type { EoxCompany } from "./planilha";

export type EoxBatchResult =
  | { ok: true; missingRows: { cnpj: string; company: string; code: string | null }[]; found: number; missing: number; created: number; ids: number; codes: number; filled: number; info: number; phones: number; emails: number; people: number }
  | { ok: false; message: string };

const MAX_BATCH = 400;
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
const txt = (v: unknown, max = 300): string | null => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };

/**
 * Grava um lote de empresas da EOX. Regras: só completa o que está vazio (Ids, endereço, telefones, e-mails, contatos);
 * o "retrato da EOX" (tipo, vendedor, bloqueio de discagem, compras…) é sempre atualizado, porque a EOX é a fonte.
 * Com `apply` falso só conta (prévia). Com `create`, empresas que ainda não são leads viram leads.
 */
export async function importEoxBatchAction(input: EoxCompany[], apply: boolean, create: boolean, batchLabel: string, batchId: number | null = null, overwrite = false): Promise<EoxBatchResult> {
  const me = await requireAdmin();
  if (!Array.isArray(input) || input.length === 0) return { ok: false, message: "Lote vazio." };
  if (input.length > MAX_BATCH) return { ok: false, message: `Lote grande demais (máximo ${MAX_BATCH}).` };
  const rows = input.filter((c) => /^\d{14}$/.test(String(c?.cnpj ?? "")));
  const res = { found: 0, missing: 0, created: 0, ids: 0, codes: 0, filled: 0, info: 0, phones: 0, emails: 0, people: 0 };

  const existing = await db
    .select({ id: leads.id, cnpj: leads.cnpj, eoxId: leads.eoxId, eoxCode: leads.eoxCode, tradeName: leads.tradeName, address: leads.address, neighborhood: leads.neighborhood, zip: leads.zip, city: leads.city, uf: leads.uf, email: leads.email, phones: leads.phones, eoxInfo: leads.eoxInfo, eoxSyncedAt: leads.eoxSyncedAt })
    .from(leads).where(inArray(leads.cnpj, rows.map((r) => r.cnpj)));
  const byCnpj = new Map(existing.map((l) => [l.cnpj, l]));
  const todo = rows.filter((r) => byCnpj.has(r.cnpj));
  const absent = rows.filter((r) => !byCnpj.has(r.cnpj));
  res.found = todo.length;
  res.missing = absent.length;

  // contagem (prévia e gravação usam as mesmas regras)
  for (const c of todo) {
    const l = byCnpj.get(c.cnpj)!;
    const diff = (n: string | null | undefined, o: string | null) => !!n && (overwrite ? n !== o : !o);
    if (diff(c.recordId, l.eoxId)) res.ids++;
    if (diff(c.code, l.eoxCode)) res.codes++;
    if (diff(c.tradeName, l.tradeName) || diff(c.address, l.address) || diff(c.neighborhood, l.neighborhood) || diff(c.zip, l.zip) || diff(c.city, l.city) || diff(c.uf, l.uf) || diff(c.email, l.email)) res.filled++;
    if (Object.keys(c.info ?? {}).length) res.info++;
    res.phones += c.phones.filter((p) => !l.phones.includes(p)).length;
    if (diff(c.email, l.email)) res.emails++;
    res.people += (c.people ?? []).length;
  }
  if (create) res.created = absent.length;
  const missingRows = absent.slice(0, 400).map((c) => ({ cnpj: c.cnpj, company: c.company, code: c.code }));
  if (!apply) return { ok: true, missingRows, ...res };

  await db.transaction(async (tx) => {
    const now = new Date();
    const journal = async (kind: "lead_before" | "lead_created" | "person" | "channel" | "channel_link", rows: { refId: number; before?: unknown }[]) => { if (batchId && rows.length) await tx.insert(importUndo).values(rows.map((r) => ({ batchId, kind, refId: r.refId, before: (r.before ?? null) as never }))); };
    await journal("lead_before", todo.map((c) => { const l = byCnpj.get(c.cnpj)!; return { refId: l.id, before: { eoxId: l.eoxId, eoxCode: l.eoxCode, tradeName: l.tradeName, address: l.address, neighborhood: l.neighborhood, zip: l.zip, city: l.city, uf: l.uf, email: l.email, phones: l.phones, eoxInfo: l.eoxInfo, eoxSyncedAt: l.eoxSyncedAt } }; }));
    if (create && absent.length) {
      const ins = await tx.insert(leads).values(absent.map((c) => ({
        cnpj: c.cnpj, company: txt(c.company) ?? c.cnpj, tradeName: txt(c.tradeName), phones: c.phones, email: c.email, address: txt(c.address), neighborhood: txt(c.neighborhood), zip: txt(c.zip, 20), city: txt(c.city, 80), uf: txt(c.uf, 2),
        eoxId: txt(c.recordId, 20), eoxCode: txt(c.code, 20), eoxInfo: c.info ?? null, eoxSyncedAt: now, source: `EOX · ${batchLabel}`.slice(0, 120), importBatchId: batchId,
        kind: c.isCustomer ? ("inativo" as const) : ("prospect" as const),
      }))).onConflictDoNothing().returning({ id: leads.id, cnpj: leads.cnpj, phones: leads.phones, email: leads.email });
      for (const l of ins) {
        const c = absent.find((a) => a.cnpj === l.cnpj)!;
        byCnpj.set(l.cnpj, { id: l.id, cnpj: l.cnpj, eoxId: c.recordId, eoxCode: c.code, tradeName: c.tradeName, address: c.address, neighborhood: c.neighborhood, zip: c.zip, city: c.city, uf: c.uf, email: c.email, phones: [], eoxInfo: null, eoxSyncedAt: null });
        todo.push(c);
      }
      res.created = ins.length;
      await journal("lead_created", ins.map((l) => ({ refId: l.id })));
    }
    if (!todo.length) return;

    const pick = (col: string, v: string) => sql.raw(overwrite ? `coalesce(v.${v}, l.${col})` : `coalesce(l.${col}, v.${v})`);
    // 1) leads existentes: completa o que falta e troca o retrato
    for (const part of chunk(todo, 200)) {
      const vals = part.map((c) => {
        const id = byCnpj.get(c.cnpj)!.id;
        return sql`(${id}::int, ${txt(c.recordId, 20)}::text, ${txt(c.code, 20)}::text, ${txt(c.tradeName)}::text, ${txt(c.address)}::text, ${txt(c.neighborhood)}::text, ${txt(c.zip, 20)}::text, ${txt(c.city, 80)}::text, ${txt(c.uf, 2)}::text, ${c.email}::text, ${Object.keys(c.info ?? {}).length ? JSON.stringify(c.info) : null}::jsonb)`;
      });
      await tx.execute(sql`
        update leads l set
          eox_id = ${pick("eox_id", "rec")}, eox_code = ${pick("eox_code", "code")}, trade_name = ${pick("trade_name", "trade")},
          address = ${pick("address", "addr")}, neighborhood = ${pick("neighborhood", "nb")}, zip = ${pick("zip", "zip")},
          city = ${pick("city", "city")}, uf = ${pick("uf", "uf")}, email = ${pick("email", "email")},
          eox_info = coalesce(v.info, l.eox_info), eox_synced_at = case when v.info is null then l.eox_synced_at else now() end
        from (values ${sql.join(vals, sql`, `)}) as v(id, rec, code, trade, addr, nb, zip, city, uf, email, info)
        where l.id = v.id`);
    }

    // 2) telefones do lead (ficha) e canais
    for (const part of chunk(todo, 200)) {
      const ch = part.flatMap((c) => {
        const id = byCnpj.get(c.cnpj)!.id;
        return [...c.phones.map((p) => ({ leadId: id, kind: "phone" as const, value: p })), ...(c.email ? [{ leadId: id, kind: "email" as const, value: c.email }] : [])].map((x) => ({ ...x, origin: "import" as const }));
      });
      if (ch.length) await journal("channel", (await tx.insert(leadChannels).values(ch).onConflictDoNothing().returning({ id: leadChannels.id })).map((r) => ({ refId: r.id })));
      const withPhones = part.filter((c) => c.phones.length);
      if (withPhones.length) {
        const vals = withPhones.map((c) => sql`(${byCnpj.get(c.cnpj)!.id}::int, ARRAY[${sql.join(c.phones.map((x) => sql`${x}`), sql`, `)}]::text[])`);
        await tx.execute(sql`update leads l set phones = (select coalesce(array_agg(distinct p), '{}') from unnest(l.phones || v.p) p) from (values ${sql.join(vals, sql`, `)}) as v(id, p) where l.id = v.id and not (v.p <@ l.phones)`);
      }
    }

    // 3) contatos (pessoas) e o telefone de cada um
    const withPeople = todo.filter((c) => (c.people ?? []).length);
    for (const part of chunk(withPeople, 100)) {
      const ids = part.map((c) => byCnpj.get(c.cnpj)!.id);
      const have = await tx.select({ id: leadPeople.id, leadId: leadPeople.leadId, name: leadPeople.name }).from(leadPeople).where(inArray(leadPeople.leadId, ids));
      const known = new Map(have.map((p) => [`${p.leadId}:${p.name.toLowerCase()}`, p.id]));
      const toAdd: { leadId: number; name: string; roleTitle: string | null; roleKind: string | null; source: string }[] = [];
      for (const c of part) for (const p of c.people) {
        const leadId = byCnpj.get(c.cnpj)!.id;
        if (known.has(`${leadId}:${p.name.toLowerCase()}`)) continue;
        known.set(`${leadId}:${p.name.toLowerCase()}`, -1);
        toAdd.push({ leadId, name: p.name.slice(0, 120), roleTitle: txt(p.role, 120), roleKind: await roleKindOf(p.role), source: "eox" });
      }
      if (toAdd.length) {
        const made = await tx.insert(leadPeople).values(toAdd).returning({ id: leadPeople.id, leadId: leadPeople.leadId, name: leadPeople.name });
        await journal("person", made.map((m) => ({ refId: m.id })));
        for (const m of made) known.set(`${m.leadId}:${m.name.toLowerCase()}`, m.id);
      }
      const chans: { leadId: number; personId: number; kind: "phone" | "email"; value: string; origin: "import" }[] = [];
      for (const c of part) for (const p of c.people) {
        const leadId = byCnpj.get(c.cnpj)!.id;
        const personId = known.get(`${leadId}:${p.name.toLowerCase()}`);
        if (!personId || personId < 0) continue;
        for (const ph of p.phones) chans.push({ leadId, personId, kind: "phone", value: ph, origin: "import" });
        if (p.email) chans.push({ leadId, personId, kind: "email", value: p.email, origin: "import" });
      }
      if (chans.length) {
        await journal("channel", (await tx.insert(leadChannels).values(chans).onConflictDoNothing().returning({ id: leadChannels.id })).map((r) => ({ refId: r.id })));
        // canal que já existia sem pessoa (ex.: telefone da empresa que também é do contato) ganha a pessoa
        const vals = chans.map((c) => sql`(${c.leadId}::int, ${c.kind}::text, ${c.value}::text, ${c.personId}::int)`);
        const linked = await tx.execute<{ id: number }>(sql`update lead_channels c set person_id = v.pid from (values ${sql.join(vals, sql`, `)}) as v(lid, k, val, pid) where c.lead_id = v.lid and c.kind = v.k and c.value = v.val and c.person_id is null returning c.id`);
        await journal("channel_link", linked.map((r) => ({ refId: Number(r.id) })));
      }
    }

    await logAudit(tx, { userId: me.id, entity: "import", action: "importou planilha da EOX", field: batchLabel.slice(0, 80), newValue: `${todo.length} leads; Id ${res.ids}, código ${res.codes}, retrato ${res.info}, contatos ${res.people}${create ? `, criados ${res.created}` : ""}` });
  });
  revalidatePath("/leads");
  return { ok: true, missingRows, ...res };
}

/** Abre o registro da importação (para poder desfazer depois). Devolve o número do lote. */
export async function beginEoxImportAction(label: string, total: number): Promise<{ ok: true; batchId: number } | { ok: false; message: string }> {
  const me = await requireAdmin();
  const [b] = await db.insert(importBatches).values({ kind: "eox", fileName: String(label).slice(0, 200) || "planilha EOX", userId: me.id, total: Math.max(0, Math.floor(total) || 0) }).returning({ id: importBatches.id });
  return { ok: true, batchId: b.id };
}

/** Fecha o lote com os números finais. */
export async function finishEoxImportAction(batchId: number, changed: number, skipped: number): Promise<void> {
  await requireAdmin();
  await db.update(importBatches).set({ inserted: Math.max(0, Math.floor(changed) || 0), skipped: Math.max(0, Math.floor(skipped) || 0) }).where(eq(importBatches.id, batchId));
}

/** Desfaz uma importação da EOX: volta os leads ao que eram e apaga o que ela criou (leads novos só se ninguém trabalhou). */
export async function undoEoxImportAction(batchId: number): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  const [b] = await db.select().from(importBatches).where(eq(importBatches.id, batchId));
  if (!b || b.kind !== "eox") return { ok: false, message: "Importação não encontrada." };
  if (b.undoneAt) return { ok: false, message: "Esta importação já foi desfeita." };
  const out = { restored: 0, removedLeads: 0, keptLeads: 0 };
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(importUndo).where(eq(importUndo.batchId, batchId));
    const ids = (k: string) => rows.filter((r) => r.kind === k).map((r) => r.refId);
    for (const part of chunk(ids("channel_link"), 500)) await tx.update(leadChannels).set({ personId: null }).where(inArray(leadChannels.id, part));
    for (const part of chunk(ids("channel"), 500)) await tx.delete(leadChannels).where(inArray(leadChannels.id, part));
    for (const part of chunk(ids("person"), 500)) await tx.delete(leadPeople).where(inArray(leadPeople.id, part));
    const created = new Set(ids("lead_created"));
    for (const r of rows.filter((x) => x.kind === "lead_before" && !created.has(x.refId))) {
      const v = (r.before ?? {}) as Record<string, unknown>;
      const upd = await tx.update(leads).set({
        eoxId: (v.eoxId as string | null) ?? null, eoxCode: (v.eoxCode as string | null) ?? null, tradeName: (v.tradeName as string | null) ?? null, address: (v.address as string | null) ?? null,
        neighborhood: (v.neighborhood as string | null) ?? null, zip: (v.zip as string | null) ?? null, city: (v.city as string | null) ?? null, uf: (v.uf as string | null) ?? null, email: (v.email as string | null) ?? null,
        phones: (v.phones as string[] | undefined) ?? [], eoxInfo: (v.eoxInfo as Record<string, string> | null) ?? null, eoxSyncedAt: v.eoxSyncedAt ? new Date(String(v.eoxSyncedAt)) : null,
      }).where(eq(leads.id, r.refId)).returning({ id: leads.id });
      out.restored += upd.length;
    }
    if (created.size) {
      const gone = await tx.execute<{ id: number }>(sql`delete from leads l where l.id in (${sql.join([...created].map((i) => sql`${i}`), sql`, `)}) and not (l.times_served > 0 or l.times_worked > 0 or l.locked_by is not null
        or exists (select 1 from deals d where d.lead_id = l.id) or exists (select 1 from visits v where v.lead_id = l.id) or exists (select 1 from attendance_sessions a where a.lead_id = l.id) or exists (select 1 from interactions i where i.lead_id = l.id)) returning l.id`);
      out.removedLeads = gone.length; out.keptLeads = created.size - gone.length;
    }
    await tx.update(importBatches).set({ undoneAt: new Date(), undoneCount: out.restored + out.removedLeads }).where(eq(importBatches.id, batchId));
    await logAudit(tx, { userId: me.id, entity: "import", action: "desfez a importação da EOX", field: b.fileName, newValue: `${out.restored} leads voltaram ao que eram, ${out.removedLeads} leads criados apagados` });
  });
  revalidatePath("/leads"); revalidatePath("/admin/importar"); revalidatePath("/admin/eox");
  return { ok: true, message: `${out.restored} lead(s) voltaram ao que eram${out.removedLeads ? `, ${out.removedLeads} criado(s) apagado(s)` : ""}${out.keptLeads ? `; ${out.keptLeads} criado(s) ficaram porque já foram trabalhados` : ""}.` };
}
