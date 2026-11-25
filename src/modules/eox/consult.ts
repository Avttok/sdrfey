import { and, eq, sql } from "drizzle-orm";
import { db, eoxLog, leadChannels, leadPeople, leads } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { digitsOf, eoxDescribe, eoxFields, eoxQuery, recordOf, withEox, type EoxSession } from "./client";
import { eoxReady } from "./config";
import { mapAccount, type EoxFound, type EoxRow } from "./consult-parse";
import { linkLeads, loadEox } from "./sync";

export type EoxOrigin = "lote" | "manual" | "auto";
export type EoxConsult = { ok: boolean; why: string | null; /** a EOX não tem o cliente: repetir não adianta tão cedo */ permanent?: boolean; newPhones: number; newEmails: number; people: number; filled: number; record: string | null };
const none = (why: string, permanent = false): EoxConsult => ({ ok: false, why, permanent, newPhones: 0, newEmails: 0, people: 0, filled: 0, record: null });

/** Rótulos dos campos (nome interno → rótulo), guardados 30 min: o "describe" da EOX é pesado. */
let labelCache: { key: string; at: number; map: Map<string, string> } | null = null;
async function labelsOf(s: EoxSession): Promise<Map<string, string>> {
  const key = `${s.cfg.baseUrl}|${s.cfg.module}`;
  if (labelCache && labelCache.key === key && Date.now() - labelCache.at < 30 * 60_000) return labelCache.map;
  try { const m = new Map((await eoxFields(s)).map((f) => [f.name, f.label])); labelCache = { key, at: Date.now(), map: m }; return m; }
  catch { return labelCache?.map ?? new Map(); }
}

const mask = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const newest = (rows: EoxRow[]) => rows.reduce<EoxRow | null>((a, r) => (!a || Number(recordOf(String(r.id)) ?? 0) > Number(recordOf(String(a.id)) ?? 0) ? r : a), null);

/** Cadastro completo na EOX: pelo CNPJ e, se não houver, pelo Código do cliente. Mais de um? Fica o mais recente. */
async function fetchAccount(s: EoxSession, cnpj: string, code: string | null): Promise<EoxRow | null> {
  const d = digitsOf(cnpj), c = s.cfg;
  if (d.length === 14 && c.cnpjField) {
    const r = newest(await eoxQuery(s, `SELECT * FROM ${c.module} WHERE ${c.cnpjField} = '${d}' OR ${c.cnpjField} = '${mask(d)}' LIMIT 0, 5;`));
    if (r) return r;
  }
  if (c.codeField && code && /^[A-Za-z0-9._-]{1,30}$/.test(code.trim())) return newest(await eoxQuery(s, `SELECT * FROM ${c.module} WHERE ${c.codeField} = '${code.trim()}' LIMIT 0, 5;`));
  return null;
}
/** Contatos da empresa na EOX (módulo Contacts). Se o módulo não responder, segue sem eles. */
async function fetchContacts(s: EoxSession, wsId: string): Promise<EoxRow[]> {
  if (!/^\d+x\d+$/.test(wsId)) return [];
  try { return await eoxQuery(s, `SELECT * FROM Contacts WHERE account_id = '${wsId}' LIMIT 0, 20;`); } catch { return []; }
}

/**
 * Lista "Telefones" da EOX (módulo próprio, ligado à empresa): traz todos os números com o tipo (Fixo, Celular, WhatsApp…).
 * O nome dos campos vem do "describe"; se o módulo não responder, segue sem ela.
 */
let phoneMeta: { key: string; at: number; ref: string; num: string | null } | null = null;
async function fetchPhoneRows(s: EoxSession, wsId: string): Promise<{ value: string; type: string | null }[]> {
  if (!/^\d+x\d+$/.test(wsId)) return [];
  try {
    const key = s.cfg.baseUrl;
    if (!phoneMeta || phoneMeta.key !== key || Date.now() - phoneMeta.at > 30 * 60_000) {
      const f = await eoxDescribe(s, "Telefones");
      const ref = f.find((x) => x.type === "reference" && x.refersTo.includes(s.cfg.module))?.name ?? "parent_id";
      const num = f.find((x) => x.name !== "tipo_telefone" && /n[uú]mero|telefone|fone/i.test(x.label) && x.type !== "reference")?.name ?? null;
      phoneMeta = { key, at: Date.now(), ref, num };
    }
    const rows = await eoxQuery(s, `SELECT * FROM Telefones WHERE ${phoneMeta.ref} = '${wsId}' LIMIT 0, 30;`);
    const out: { value: string; type: string | null }[] = [];
    for (const r of rows) {
      const direct = phoneMeta.num ? String(r[phoneMeta.num] ?? "") : "";
      const value = direct || Object.values(r).map(String).find((v) => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.trim())) || "";
      if (value) out.push({ value, type: typeof r.tipo_telefone === "string" && r.tipo_telefone ? r.tipo_telefone : null });
    }
    return out;
  } catch { return []; }
}

/** Grava no lead só o que está vazio (o que a pessoa digitou nunca é trocado) e soma telefones, e-mails e pessoas novos. */
async function apply(leadId: number, f: EoxFound, record: string | null, userId: number | null): Promise<Pick<EoxConsult, "newPhones" | "newEmails" | "people" | "filled">> {
  let newPhones = 0, newEmails = 0, people = 0, filled = 0;
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(leads).where(eq(leads.id, leadId));
    if (!cur) return;
    const blank = (v: string | null) => !v?.trim();
    const set: Partial<typeof leads.$inferInsert> = {};
    const fill = <K extends "site" | "address" | "neighborhood" | "zip" | "city" | "uf" | "contactName" | "email">(k: K, v: string | null) => { if (v && blank(cur[k] as string | null)) { (set as Record<string, unknown>)[k] = v; filled++; } };
    fill("site", f.site); fill("address", f.address); fill("neighborhood", f.neighborhood); fill("zip", f.zip); fill("city", f.city); fill("uf", f.uf); fill("contactName", f.contactName); fill("email", f.emails[0] ?? null);
    const info = { ...(cur.eoxInfo ?? {}), ...f.info };
    await tx.update(leads).set({ ...set, eoxInfo: info, eoxSyncedAt: new Date(), eoxCheckedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId));

    for (const p of f.people) {
      const [dup] = await tx.select({ id: leadPeople.id }).from(leadPeople).where(and(eq(leadPeople.leadId, leadId), sql`lower(btrim(${leadPeople.name})) = ${p.name.toLowerCase()}`)).limit(1);
      let pid = dup?.id;
      if (!pid) { const [r] = await tx.insert(leadPeople).values({ leadId, name: p.name, roleTitle: p.title, source: "eox" }).returning({ id: leadPeople.id }); pid = r.id; people++; }
      for (const v of p.phones) { const r = await tx.insert(leadChannels).values({ leadId, personId: pid, kind: "phone", value: v, label: f.phoneKinds[v] ?? null, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newPhones += r.length; }
      for (const v of p.emails) { const r = await tx.insert(leadChannels).values({ leadId, personId: pid, kind: "email", value: v, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newEmails += r.length; }
    }
    for (const v of f.phones) { const r = await tx.insert(leadChannels).values({ leadId, kind: "phone", value: v, label: f.phoneKinds[v] ?? null, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newPhones += r.length; }
    for (const v of f.emails) { const r = await tx.insert(leadChannels).values({ leadId, kind: "email", value: v, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newEmails += r.length; }
    await logAudit(tx, { userId, leadId, entity: "lead", action: "atualizou dados pela EOX", field: "Consulta EOX", newValue: record, meta: { telefonesNovos: newPhones, emailsNovos: newEmails, pessoasNovas: people, camposPreenchidos: filled } });
  });
  if (record) await linkLeads(db, new Map([[digitsOf((await db.select({ c: leads.cnpj }).from(leads).where(eq(leads.id, leadId)))[0]?.c), record]]), new Map(), userId);
  return { newPhones, newEmails, people, filled };
}

/** Procura o lead na EOX (por CNPJ e Código do cliente), traz o cadastro e os contatos e completa o que falta. Registra no histórico. */
export async function eoxConsultLead(leadId: number, userId: number | null = null, origin: EoxOrigin = "manual"): Promise<EoxConsult> {
  const t0 = Date.now();
  const r = await core(leadId, userId).catch((e) => none(`erro: ${e instanceof Error ? e.message : "desconhecido"}`));
  try { await db.insert(eoxLog).values({ leadId, origin, ok: r.ok, ms: Date.now() - t0, userId, phones: r.newPhones, emails: r.newEmails, people: r.people, filled: r.filled, why: r.why ? r.why.slice(0, 300) : null }); } catch { /* o histórico nunca derruba a consulta */ }
  return r;
}

async function core(leadId: number, userId: number | null): Promise<EoxConsult> {
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return none("integração com a EOX desligada ou incompleta (Admin > EOX > Conexão)");
  const [l] = await db.select({ cnpj: leads.cnpj, code: leads.eoxCode }).from(leads).where(eq(leads.id, leadId));
  if (!l) return none("lead não encontrado", true);
  if (digitsOf(l.cnpj).length !== 14 && !(l.code && cfg.codeField)) return none("o lead não tem CNPJ nem ID EOX para procurar", true);
  let found: { f: EoxFound; record: string | null } | null;
  try {
    found = await withEox(cfg, async (s) => {
      const row = await fetchAccount(s, l.cnpj, l.code);
      if (!row) return null;
      const [labels, contacts, phoneRows] = await Promise.all([labelsOf(s), fetchContacts(s, String(row.id)), fetchPhoneRows(s, String(row.id))]);
      return { f: mapAccount(row, labels, contacts, phoneRows), record: recordOf(String(row.id)) };
    });
  } catch (e) { return none(`a EOX não respondeu: ${(e as Error).message}`); }
  if (!found) {
    await db.update(leads).set({ eoxTriedAt: new Date(Date.now() + 7 * 864e5) }).where(eq(leads.id, leadId)); // a EOX não conhece: não volta à fila por 7 dias
    return none("a EOX não tem cadastro com esse CNPJ/ID", true);
  }
  const done = await apply(leadId, found.f, found.record, userId);
  return { ok: true, why: null, record: found.record, ...done };
}
