"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leadChannels, leadFacts, leadPeople, leads } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin, requireUser } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { decodeCsv, parseCsv } from "@/modules/import/csv";
import { pickKeeper, type DupPerson, type DupSet, findSets } from "@/config/contact-merge";
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

export type DupGroup = { leadId: number; company: string; people: DupPerson[] };

/**
 * Empresas com mais de uma pessoa ativa, com telefones, e-mails e dados de cada uma. Só olha as empresas candidatas
 * e agrega tudo de uma vez (nada de subconsulta por pessoa): a página abre rápido mesmo com a base grande.
 */
async function loadCandidates(limitLeads = 400): Promise<DupGroup[]> {
  const rows = await db.execute<{ lead_id: number; company: string; id: number; name: string; role_title: string | null; phones: string[] | null; emails: string[] | null; facts: number }>(sql`
    with cand as (
      select p.lead_id from lead_people p join leads l on l.id = p.lead_id
      where p.status = 'ativo' and not l.is_test group by p.lead_id having count(*) > 1 order by p.lead_id limit ${limitLeads}),
    ch as (
      select c.person_id,
        array_agg(c.value) filter (where c.kind = 'phone') as phones,
        array_agg(c.value) filter (where c.kind = 'email') as emails
      from lead_channels c where c.lead_id in (select lead_id from cand) and c.person_id is not null group by c.person_id),
    fc as (
      select f.person_id, count(*)::int as n from lead_facts f where f.lead_id in (select lead_id from cand) and f.current and f.person_id is not null group by f.person_id)
    select p.lead_id, l.company, p.id, p.name, p.role_title, ch.phones, ch.emails, coalesce(fc.n, 0) as facts
    from lead_people p join leads l on l.id = p.lead_id
      left join ch on ch.person_id = p.id left join fc on fc.person_id = p.id
    where p.status = 'ativo' and p.lead_id in (select lead_id from cand)
    order by p.lead_id, p.id`);
  const byLead = new Map<number, DupGroup>();
  for (const r of rows) {
    const g = byLead.get(r.lead_id) ?? { leadId: r.lead_id, company: r.company, people: [] };
    g.people.push({ id: r.id, name: r.name, roleTitle: r.role_title, phones: r.phones ?? [], emails: r.emails ?? [], facts: Number(r.facts) });
    byLead.set(r.lead_id, g);
  }
  return [...byLead.values()];
}

/** Os conjuntos de contatos que parecem ser a mesma pessoa, já separados por certeza. */
export async function findDuplicateSetsAction(): Promise<DupSet[]> {
  await requireAdmin();
  const sets = findSets(await loadCandidates());
  return sets.sort((a, b) => Number(b.sure) - Number(a.sure) || a.company.localeCompare(b.company)).slice(0, 150);
}

/** Compatibilidade: lista por empresa (como antes). */
export async function findDuplicatesAction(): Promise<DupGroup[]> {
  const sets = await findDuplicateSetsAction();
  const m = new Map<number, DupGroup>();
  for (const s of sets) { const g = m.get(s.leadId) ?? { leadId: s.leadId, company: s.company, people: [] }; g.people.push(...s.people); m.set(s.leadId, g); }
  return [...m.values()];
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Junta um contato no outro dentro da transação: tudo do que sai passa para o que fica. */
async function mergeInTx(tx: Tx, keepId: number, dropId: number, adminId: number): Promise<{ ok: boolean; message: string; leadId?: number }> {
  const [keep] = await tx.select().from(leadPeople).where(eq(leadPeople.id, keepId)).for("update");
  const [drop] = await tx.select().from(leadPeople).where(eq(leadPeople.id, dropId)).for("update");
  if (!keep || !drop) return { ok: false, message: "Um dos contatos já não existe (talvez já tenha sido juntado)." };
  if (keep.leadId !== drop.leadId) return { ok: false, message: "Os dois contatos precisam ser da mesma empresa." };
  // telefones e e-mails: os que a pessoa que fica já tem não se repetem
  await tx.execute(sql`delete from lead_channels c where c.person_id = ${dropId} and exists (select 1 from lead_channels k where k.person_id = ${keepId} and k.kind = c.kind and k.value = c.value)`);
  await tx.update(leadChannels).set({ personId: keepId }).where(eq(leadChannels.personId, dropId));
  // dados guardados: vale o do contato que fica; os que só o outro tinha passam para ele
  await tx.execute(sql`delete from lead_facts f where f.person_id = ${dropId} and f.current and exists (select 1 from lead_facts k where k.person_id = ${keepId} and k.key = f.key and k.current)`);
  await tx.update(leadFacts).set({ personId: keepId }).where(eq(leadFacts.personId, dropId));
  // o nome mais completo vence ("Carlos" + "Carlos Silva" vira "Carlos Silva")
  const nk = stripAccents(keep.name).toLowerCase().trim(), nd = stripAccents(drop.name).toLowerCase().trim();
  const fuller = nd.length > nk.length && nd.startsWith(nk + " ") ? drop.name : keep.name;
  await tx.update(leadPeople).set({ name: fuller, roleTitle: keep.roleTitle || drop.roleTitle, roleKind: keep.roleKind || drop.roleKind, extension: keep.extension || drop.extension, notes: [keep.notes, drop.notes].filter(Boolean).join(" · ") || null, preferredChannel: keep.preferredChannel || drop.preferredChannel, bestTime: keep.bestTime || drop.bestTime }).where(eq(leadPeople.id, keepId));
  await tx.delete(leadPeople).where(eq(leadPeople.id, dropId));
  await logAudit(tx, { userId: adminId, leadId: keep.leadId, entity: "lead", action: "juntou dois contatos", field: keep.name, oldValue: drop.name, newValue: fuller });
  return { ok: true, message: `“${drop.name}” foi juntado a “${fuller}”.`, leadId: keep.leadId };
}

/** Junta dois contatos: tudo do que sai (telefones, e-mails, dados guardados) passa para o que fica. */
export async function mergeContactsAction(keepId: number, dropId: number): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId === dropId) return { ok: false, message: "Escolha dois contatos diferentes." };
  try { return await db.transaction((tx) => mergeInTx(tx, keepId, dropId, me.id)); } catch { return { ok: false, message: "Não consegui juntar agora. Nada foi alterado; tente de novo." }; }
}

/** Junta um conjunto inteiro (vários contatos) em quem fica, de uma vez: ou junta tudo ou não muda nada. */
export async function mergeSetAction(keepId: number, dropIds: number[]): Promise<ActionResult> {
  const me = await requireAdmin();
  const drops = [...new Set(dropIds)].filter((x) => Number.isInteger(x) && x !== keepId);
  if (!Number.isInteger(keepId) || !drops.length || drops.length > 20) return { ok: false, message: "Escolha quem fica e quem será juntado." };
  let why = "";
  try {
    return await db.transaction(async (tx) => {
      let last: { ok: boolean; message: string } = { ok: true, message: "" };
      for (const d of drops) { last = await mergeInTx(tx, keepId, d, me.id); if (!last.ok) { why = last.message; tx.rollback(); } }
      return { ok: true, message: drops.length === 1 ? last.message : `${drops.length} contatos foram juntados.` } as ActionResult;
    });
  } catch { return { ok: false, message: why || "Não consegui juntar agora. Nada foi alterado; tente de novo." }; }
}

/** Junta de uma vez todos os conjuntos "com certeza" (mesmo telefone, e-mail ou nome igual), mantendo quem a regra escolher. */
export async function mergeSureSetsAction(preferContact: boolean): Promise<ActionResult & { merged?: number }> {
  const me = await requireAdmin();
  const sets = (await findDuplicateSetsAction()).filter((s) => s.sure);
  let merged = 0, failed = 0;
  for (const s of sets) {
    const keep = pickKeeper(s.people, preferContact);
    try {
      await db.transaction(async (tx) => { for (const p of s.people) if (p.id !== keep) { const r = await mergeInTx(tx, keep, p.id, me.id); if (!r.ok) tx.rollback(); } });
      merged += s.people.length - 1;
    } catch { failed++; }
  }
  return { ok: true, merged, message: `${merged} contato(s) juntado(s)${failed ? `, ${failed} conjunto(s) ficaram de fora (confira um a um)` : ""}.` };
}
