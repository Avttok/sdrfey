"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leadChannels, leadFacts, leadPeople, leads } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin, requireUser } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { decodeCsv, parseCsv } from "@/modules/import/csv";
import { headerKey, normalizeCnpj, normalizeEmail, splitPhones, stripAccents } from "@/modules/import/normalize";

/** "Comprador", "Compras" → comprador; "Recepção" → portaria… (o resto fica como "outro"). */
export async function roleKindOf(text: string | null | undefined): Promise<string | null> {
  const t = stripAccents(String(text ?? "")).toLowerCase();
  if (!t.trim()) return null;
  if (/portaria|recepc|porteiro/.test(t)) return "Portaria";
  if (/secret|assistente|administrativ/.test(t)) return "Secretaria";
  if (/compra|comprador|suprimento|procurement/.test(t)) return "Comprador";
  if (/dono|socio|proprietario|diretor|ceo|presidente/.test(t)) return "Dono ou sócio";
  if (/engenh|manuten|producao|tecnic/.test(t)) return "Engenharia ou manutenção";
  return "Outro";
}

const COLS: Record<string, string[]> = {
  cnpj: ["CNPJ"],
  name: ["NOME", "CONTATO", "NOMEDOCONTATO", "PESSOA"],
  role: ["CARGO", "FUNCAO", "SETOR"],
  phone: ["TELEFONE", "TELEFONES", "CELULAR", "FONE", "WHATSAPP", "WPP"],
  email: ["EMAIL", "EMAILS", "EMAILDOCONTATO"],
  ext: ["RAMAL"],
  note: ["OBSERVACAO", "OBS", "NOTAS"],
};
const colOf = (headers: string[], k: keyof typeof COLS) => headers.find((h) => COLS[k].some((c) => headerKey(h) === c || headerKey(h).startsWith(c)));

export type ContactsImportResult = { ok: true; applied: boolean; rows: number; leadsFound: number; created: number; updated: number; phones: number; emails: number; skipped: number; problems: string[] } | { ok: false; message: string };

/**
 * Importa contatos de uma planilha: uma linha por pessoa, ligada ao lead pelo CNPJ.
 * Colunas aceitas: CNPJ, Nome, Cargo, Telefone, E-mail, Ramal, Observação (nomes parecidos também servem).
 * Com `apply` falso só confere e conta (prévia); nada é gravado.
 */
export async function importContactsAction(form: FormData, apply: boolean): Promise<ContactsImportResult> {
  const me = await requireAdmin();
  const f = form.get("file");
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: "Escolha um arquivo CSV." };
  if (f.size > 8_000_000) return { ok: false, message: "Arquivo grande demais (máximo 8 MB)." };
  const parsed = parseCsv(decodeCsv(await f.arrayBuffer()));
  const cCnpj = colOf(parsed.headers, "cnpj"), cName = colOf(parsed.headers, "name");
  if (!cCnpj || !cName) return { ok: false, message: "A planilha precisa ter as colunas CNPJ e Nome (do contato)." };
  const cRole = colOf(parsed.headers, "role"), cPhone = colOf(parsed.headers, "phone"), cEmail = colOf(parsed.headers, "email"), cExt = colOf(parsed.headers, "ext"), cNote = colOf(parsed.headers, "note");

  const rows = parsed.rows.slice(0, 5000).map((r, i) => ({ i: i + 2, cnpj: normalizeCnpj(r[cCnpj]).cnpj, name: String(r[cName] ?? "").trim().replace(/\s+/g, " "), role: cRole ? String(r[cRole] ?? "").trim() : "", phones: cPhone ? splitPhones(r[cPhone]).phones : [], email: cEmail ? normalizeEmail(r[cEmail]) : null, ext: cExt ? String(r[cExt] ?? "").trim() : "", note: cNote ? String(r[cNote] ?? "").trim() : "" }));
  const cnpjs = [...new Set(rows.map((r) => r.cnpj).filter((x): x is string => !!x))];
  const found = cnpjs.length ? await db.select({ id: leads.id, cnpj: leads.cnpj }).from(leads).where(inArray(leads.cnpj, cnpjs)) : [];
  const leadOf = new Map(found.map((l) => [l.cnpj, l.id]));

  const res = { created: 0, updated: 0, phones: 0, emails: 0, skipped: 0 };
  const problems: string[] = [];
  const touched = new Set<number>();
  const run = async (tx: typeof db) => {
    for (const r of rows) {
      const leadId = r.cnpj ? leadOf.get(r.cnpj) : undefined;
      if (!r.cnpj) { res.skipped++; if (problems.length < 10) problems.push(`Linha ${r.i}: CNPJ inválido.`); continue; }
      if (!leadId) { res.skipped++; if (problems.length < 10) problems.push(`Linha ${r.i}: o CNPJ ${r.cnpj} não está na base.`); continue; }
      if (r.name.length < 2 || r.name.length > 80) { res.skipped++; if (problems.length < 10) problems.push(`Linha ${r.i}: nome do contato vazio ou grande demais.`); continue; }
      const key = stripAccents(r.name).toLowerCase();
      const same = await tx.select().from(leadPeople).where(eq(leadPeople.leadId, leadId));
      const old = same.find((p) => stripAccents(p.name).toLowerCase() === key);
      const roleKind = await roleKindOf(r.role);
      let personId: number;
      if (old) {
        res.updated++;
        personId = old.id;
        if (apply) await tx.update(leadPeople).set({ roleTitle: old.roleTitle || r.role || null, roleKind: old.roleKind || roleKind, extension: old.extension || r.ext || null, notes: old.notes || r.note || null, confirmedAt: new Date() }).where(eq(leadPeople.id, old.id));
      } else {
        res.created++;
        personId = 0;
        if (apply) { const [n] = await tx.insert(leadPeople).values({ leadId, name: r.name, roleTitle: r.role || null, roleKind, extension: r.ext || null, notes: r.note || null, source: "csv" }).returning({ id: leadPeople.id }); personId = n.id; }
      }
      touched.add(leadId);
      for (const ph of r.phones) {
        res.phones++;
        if (apply) await tx.insert(leadChannels).values({ leadId, personId, kind: "phone", value: ph, origin: "import" }).onConflictDoUpdate({ target: [leadChannels.leadId, leadChannels.kind, leadChannels.value], set: { personId }, setWhere: sql`${leadChannels.personId} is null` });
      }
      if (r.email) {
        res.emails++;
        if (apply) await tx.insert(leadChannels).values({ leadId, personId, kind: "email", value: r.email, origin: "import" }).onConflictDoUpdate({ target: [leadChannels.leadId, leadChannels.kind, leadChannels.value], set: { personId }, setWhere: sql`${leadChannels.personId} is null` });
      }
    }
  };
  if (apply) {
    await db.transaction(async (tx) => { await run(tx as unknown as typeof db); await logAudit(tx, { userId: me.id, entity: "import", action: "importou contatos", field: f.name, meta: { ...res, leads: touched.size } }); });
    revalidatePath("/admin/importar");
  } else await run(db);
  return { ok: true, applied: apply, rows: rows.length, leadsFound: touched.size, ...res, problems };
}

/* ───── Duplicados ───── */

export type DupGroup = { leadId: number; company: string; people: { id: number; name: string; roleTitle: string | null; phones: string[]; emails: string[]; facts: number }[] };

/** Contatos repetidos dentro da mesma empresa: mesmo nome (sem acento) ou mesmo telefone/e-mail. */
export async function findDuplicatesAction(): Promise<DupGroup[]> {
  await requireAdmin();
  const rows = await db.execute<{ lead_id: number; company: string; id: number; name: string; role_title: string | null; phones: string[]; emails: string[]; facts: number }>(sql`
    select p.lead_id, l.company, p.id, p.name, p.role_title,
      coalesce((select array_agg(c.value) from lead_channels c where c.person_id = p.id and c.kind = 'phone'), '{}') phones,
      coalesce((select array_agg(c.value) from lead_channels c where c.person_id = p.id and c.kind = 'email'), '{}') emails,
      (select count(*) from lead_facts f where f.person_id = p.id and f.current)::int facts
    from lead_people p join leads l on l.id = p.lead_id
    where p.status = 'ativo' and not l.is_test and p.lead_id in (
      select lead_id from lead_people where status = 'ativo' group by lead_id having count(*) > 1)
    order by p.lead_id, p.id limit 3000`);
  const byLead = new Map<number, DupGroup>();
  for (const r of rows) {
    const g = byLead.get(r.lead_id) ?? { leadId: r.lead_id, company: r.company, people: [] };
    g.people.push({ id: r.id, name: r.name, roleTitle: r.role_title, phones: r.phones ?? [], emails: r.emails ?? [], facts: Number(r.facts) });
    byLead.set(r.lead_id, g);
  }
  const key = (n: string) => stripAccents(n).toLowerCase().replace(/[^a-z ]/g, "").trim();
  const out: DupGroup[] = [];
  for (const g of byLead.values()) {
    const keep = new Set<number>();
    for (const a of g.people) for (const b of g.people) {
      if (a.id >= b.id) continue;
      const sameName = key(a.name) === key(b.name) || (key(a.name).length > 4 && (key(a.name).startsWith(key(b.name)) || key(b.name).startsWith(key(a.name))));
      const sameChan = a.phones.some((x) => b.phones.includes(x)) || a.emails.some((x) => b.emails.includes(x));
      if (sameName || sameChan) { keep.add(a.id); keep.add(b.id); }
    }
    if (keep.size) out.push({ ...g, people: g.people.filter((p) => keep.has(p.id)) });
  }
  return out.slice(0, 100);
}

/** Junta dois contatos: tudo do que sai (telefones, e-mails, dados guardados) passa para o que fica. */
export async function mergeContactsAction(keepId: number, dropId: number): Promise<ActionResult> {
  await requireUser();
  const me = await requireAdmin();
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId === dropId) return { ok: false, message: "Escolha dois contatos diferentes." };
  return db.transaction(async (tx) => {
    const [keep] = await tx.select().from(leadPeople).where(eq(leadPeople.id, keepId)).for("update");
    const [drop] = await tx.select().from(leadPeople).where(eq(leadPeople.id, dropId)).for("update");
    if (!keep || !drop || keep.leadId !== drop.leadId) return { ok: false, message: "Os dois contatos precisam ser da mesma empresa." } as ActionResult;
    // telefones e e-mails: os que a pessoa que fica já tem não se repetem
    await tx.execute(sql`delete from lead_channels c where c.person_id = ${dropId} and exists (select 1 from lead_channels k where k.person_id = ${keepId} and k.kind = c.kind and k.value = c.value)`);
    await tx.update(leadChannels).set({ personId: keepId }).where(eq(leadChannels.personId, dropId));
    // dados guardados: vale o do contato que fica; os que só o outro tinha passam para ele
    await tx.execute(sql`delete from lead_facts f where f.person_id = ${dropId} and exists (select 1 from lead_facts k where k.person_id = ${keepId} and k.key = f.key and k.current = f.current and f.current)`);
    await tx.update(leadFacts).set({ personId: keepId }).where(and(eq(leadFacts.personId, dropId)));
    await tx.update(leadPeople).set({ roleTitle: keep.roleTitle || drop.roleTitle, roleKind: keep.roleKind || drop.roleKind, extension: keep.extension || drop.extension, notes: [keep.notes, drop.notes].filter(Boolean).join(" · ") || null, preferredChannel: keep.preferredChannel || drop.preferredChannel, bestTime: keep.bestTime || drop.bestTime }).where(eq(leadPeople.id, keepId));
    await tx.delete(leadPeople).where(eq(leadPeople.id, dropId));
    await logAudit(tx, { userId: me.id, leadId: keep.leadId, entity: "lead", action: "juntou dois contatos", field: keep.name, oldValue: drop.name, newValue: keep.name });
    revalidatePath("/admin/contatos");
    return { ok: true, message: `“${drop.name}” foi juntado a “${keep.name}”.` } as ActionResult;
  });
}
