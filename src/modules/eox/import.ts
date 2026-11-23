"use server";

import { inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leadChannels, leadPeople, leads } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { roleKindOf } from "@/modules/facts/contacts";
import type { EoxCompany } from "./planilha";

export type EoxBatchResult =
  | { ok: true; found: number; missing: number; created: number; ids: number; codes: number; filled: number; info: number; phones: number; emails: number; people: number }
  | { ok: false; message: string };

const MAX_BATCH = 400;
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
const txt = (v: unknown, max = 300): string | null => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };

/**
 * Grava um lote de empresas da EOX. Regras: só completa o que está vazio (Ids, endereço, telefones, e-mails, contatos);
 * o "retrato da EOX" (tipo, vendedor, bloqueio de discagem, compras…) é sempre atualizado, porque a EOX é a fonte.
 * Com `apply` falso só conta (prévia). Com `create`, empresas que ainda não são leads viram leads.
 */
export async function importEoxBatchAction(input: EoxCompany[], apply: boolean, create: boolean, batchLabel: string): Promise<EoxBatchResult> {
  const me = await requireAdmin();
  if (!Array.isArray(input) || input.length === 0) return { ok: false, message: "Lote vazio." };
  if (input.length > MAX_BATCH) return { ok: false, message: `Lote grande demais (máximo ${MAX_BATCH}).` };
  const rows = input.filter((c) => /^\d{14}$/.test(String(c?.cnpj ?? "")));
  const res = { found: 0, missing: 0, created: 0, ids: 0, codes: 0, filled: 0, info: 0, phones: 0, emails: 0, people: 0 };

  const existing = await db
    .select({ id: leads.id, cnpj: leads.cnpj, eoxId: leads.eoxId, eoxCode: leads.eoxCode, tradeName: leads.tradeName, address: leads.address, neighborhood: leads.neighborhood, zip: leads.zip, city: leads.city, uf: leads.uf, email: leads.email, phones: leads.phones })
    .from(leads).where(inArray(leads.cnpj, rows.map((r) => r.cnpj)));
  const byCnpj = new Map(existing.map((l) => [l.cnpj, l]));
  const todo = rows.filter((r) => byCnpj.has(r.cnpj));
  const absent = rows.filter((r) => !byCnpj.has(r.cnpj));
  res.found = todo.length;
  res.missing = absent.length;

  // contagem (prévia e gravação usam as mesmas regras)
  for (const c of todo) {
    const l = byCnpj.get(c.cnpj)!;
    if (c.recordId && !l.eoxId) res.ids++;
    if (c.code && !l.eoxCode) res.codes++;
    if ((c.tradeName && !l.tradeName) || (c.address && !l.address) || (c.neighborhood && !l.neighborhood) || (c.zip && !l.zip) || (c.city && !l.city) || (c.uf && !l.uf)) res.filled++;
    if (Object.keys(c.info ?? {}).length) res.info++;
    res.phones += c.phones.filter((p) => !l.phones.includes(p)).length;
    if (c.email && !l.email) res.emails++;
    res.people += (c.people ?? []).length;
  }
  if (create) res.created = absent.length;
  if (!apply) return { ok: true, ...res };

  await db.transaction(async (tx) => {
    const now = new Date();
    if (create && absent.length) {
      const ins = await tx.insert(leads).values(absent.map((c) => ({
        cnpj: c.cnpj, company: txt(c.company) ?? c.cnpj, tradeName: txt(c.tradeName), phones: c.phones, email: c.email, address: txt(c.address), neighborhood: txt(c.neighborhood), zip: txt(c.zip, 20), city: txt(c.city, 80), uf: txt(c.uf, 2),
        eoxId: txt(c.recordId, 20), eoxCode: txt(c.code, 20), eoxInfo: c.info ?? null, eoxSyncedAt: now, source: `EOX · ${batchLabel}`.slice(0, 120),
        kind: c.isCustomer ? ("inativo" as const) : ("prospect" as const),
      }))).onConflictDoNothing().returning({ id: leads.id, cnpj: leads.cnpj, phones: leads.phones, email: leads.email });
      for (const l of ins) {
        const c = absent.find((a) => a.cnpj === l.cnpj)!;
        byCnpj.set(l.cnpj, { id: l.id, cnpj: l.cnpj, eoxId: c.recordId, eoxCode: c.code, tradeName: c.tradeName, address: c.address, neighborhood: c.neighborhood, zip: c.zip, city: c.city, uf: c.uf, email: c.email, phones: [] });
        todo.push(c);
      }
      res.created = ins.length;
    }
    if (!todo.length) return;

    // 1) leads existentes: completa o que falta e troca o retrato
    for (const part of chunk(todo, 200)) {
      const vals = part.map((c) => {
        const id = byCnpj.get(c.cnpj)!.id;
        return sql`(${id}::int, ${txt(c.recordId, 20)}::text, ${txt(c.code, 20)}::text, ${txt(c.tradeName)}::text, ${txt(c.address)}::text, ${txt(c.neighborhood)}::text, ${txt(c.zip, 20)}::text, ${txt(c.city, 80)}::text, ${txt(c.uf, 2)}::text, ${c.email}::text, ${Object.keys(c.info ?? {}).length ? JSON.stringify(c.info) : null}::jsonb)`;
      });
      await tx.execute(sql`
        update leads l set
          eox_id = coalesce(l.eox_id, v.rec), eox_code = coalesce(l.eox_code, v.code), trade_name = coalesce(l.trade_name, v.trade),
          address = coalesce(l.address, v.addr), neighborhood = coalesce(l.neighborhood, v.nb), zip = coalesce(l.zip, v.zip),
          city = coalesce(l.city, v.city), uf = coalesce(l.uf, v.uf), email = coalesce(l.email, v.email),
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
      if (ch.length) await tx.insert(leadChannels).values(ch).onConflictDoNothing();
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
      if (chans.length) await tx.insert(leadChannels).values(chans).onConflictDoUpdate({ target: [leadChannels.leadId, leadChannels.kind, leadChannels.value], set: { personId: sql`coalesce(${leadChannels.personId}, excluded.person_id)` } });
    }

    await logAudit(tx, { userId: me.id, entity: "import", action: "importou planilha da EOX", field: batchLabel.slice(0, 80), newValue: `${todo.length} leads; Id ${res.ids}, código ${res.codes}, retrato ${res.info}, contatos ${res.people}${create ? `, criados ${res.created}` : ""}` });
  });
  revalidatePath("/leads");
  return { ok: true, ...res };
}
