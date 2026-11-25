import { and, eq, sql } from "drizzle-orm";
import { db, eoxLog, leadChannels, leadPeople, leads } from "@/db";
import { EOX_FIELDS } from "@/config/eox-fields";
import { logAudit } from "@/modules/audit/log";
import { settingValue } from "@/modules/settings/get";
import { digitsOf, eoxDescribe, eoxLink, eoxQuery, recordOf, withEox, type EoxSession } from "./client";
import { eoxReady } from "./config";
import { CONSULT_KEY, parseConsult, type ConsultOptions } from "./consult-options";
import { mapAccount, type EoxFound, type EoxRow } from "./consult-parse";
import { isRecordId, loadEox } from "./sync";

export type EoxOrigin = "lote" | "manual" | "auto";
export type EoxConsult = { ok: boolean; why: string | null; /** a EOX não tem o cliente: repetir não adianta tão cedo */ permanent?: boolean; newPhones: number; newEmails: number; people: number; filled: number; record: string | null };
const none = (why: string, permanent = false): EoxConsult => ({ ok: false, why, permanent, newPhones: 0, newEmails: 0, people: 0, filled: 0, record: null });

export const loadConsultOptions = async (): Promise<ConsultOptions> => parseConsult(await settingValue(CONSULT_KEY));

/** Rótulos do "describe" (nome interno → rótulo), guardados 30 min: o describe da EOX é pesado. */
let labelCache: { key: string; at: number; map: Map<string, string> } | null = null;
async function labelsOf(s: EoxSession, errors: string[]): Promise<Map<string, string>> {
  const key = `${s.cfg.baseUrl}|${s.cfg.module}`;
  if (labelCache && labelCache.key === key && Date.now() - labelCache.at < 30 * 60_000) return labelCache.map;
  try { const m = new Map((await eoxDescribe(s, s.cfg.module)).map((f) => [f.name, f.label])); labelCache = { key, at: Date.now(), map: m }; return m; }
  catch (e) { errors.push(`describe ${s.cfg.module}: ${(e as Error).message}`); return labelCache?.map ?? new Map(Object.entries(EOX_FIELDS).map(([k, v]) => [k, v[0]])); }
}

const mask = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const newest = (rows: EoxRow[]) => rows.reduce<EoxRow | null>((a, r) => (!a || Number(recordOf(String(r.id)) ?? 0) > Number(recordOf(String(a.id)) ?? 0) ? r : a), null);

/** Cadastro completo na EOX: pelo CNPJ (com ou sem pontuação) e, se não houver, pelo Código do cliente. Mais de um? Fica o mais recente. */
async function fetchAccount(s: EoxSession, cnpj: string, code: string | null): Promise<{ row: EoxRow; by: "cnpj" | "código"; copies: number } | null> {
  const d = digitsOf(cnpj), c = s.cfg;
  if (d.length === 14 && c.cnpjField) {
    const rows = await eoxQuery(s, `SELECT * FROM ${c.module} WHERE ${c.cnpjField} = '${d}' OR ${c.cnpjField} = '${mask(d)}' LIMIT 0, 5;`);
    const r = newest(rows);
    if (r) return { row: r, by: "cnpj", copies: rows.length };
  }
  if (c.codeField && code && /^[A-Za-z0-9._-]{1,30}$/.test(code.trim())) {
    const rows = await eoxQuery(s, `SELECT * FROM ${c.module} WHERE ${c.codeField} = '${code.trim()}' LIMIT 0, 5;`);
    const r = newest(rows);
    if (r) return { row: r, by: "código", copies: rows.length };
  }
  return null;
}
/** Contatos da empresa na EOX (módulo Contacts). Se o módulo não responder, segue sem eles. */
async function fetchContacts(s: EoxSession, wsId: string, errors: string[]): Promise<EoxRow[]> {
  if (!/^\d+x\d+$/.test(wsId)) return [];
  try { return await eoxQuery(s, `SELECT * FROM Contacts WHERE account_id = '${wsId}' LIMIT 0, 30;`); } catch (e) { errors.push(`Contacts: ${(e as Error).message}`); return []; }
}

/** Lista "Telefones" da EOX (módulo próprio, ligado à empresa): todos os números com o tipo. Os nomes dos campos vêm do describe. */
let phoneMeta: { key: string; at: number; ref: string; num: string | null } | null = null;
async function fetchPhoneRows(s: EoxSession, wsId: string, errors: string[]): Promise<{ value: string; type: string | null }[]> {
  if (!/^\d+x\d+$/.test(wsId)) return [];
  try {
    const key = s.cfg.baseUrl;
    if (!phoneMeta || phoneMeta.key !== key || Date.now() - phoneMeta.at > 30 * 60_000) {
      const f = await eoxDescribe(s, "Telefones");
      const ref = f.find((x) => x.type === "reference" && x.refersTo.includes(s.cfg.module))?.name ?? "parent_id";
      const num = f.find((x) => x.name !== "tipo_telefone" && /n[uú]mero|telefone|fone/i.test(x.label) && x.type !== "reference")?.name ?? null;
      phoneMeta = { key, at: Date.now(), ref, num };
    }
    const rows = await eoxQuery(s, `SELECT * FROM Telefones WHERE ${phoneMeta.ref} = '${wsId}' LIMIT 0, 50;`);
    const out: { value: string; type: string | null }[] = [];
    for (const r of rows) {
      const direct = phoneMeta.num ? String(r[phoneMeta.num] ?? "") : "";
      const value = direct || Object.values(r).map(String).find((v) => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v.trim())) || "";
      if (value) out.push({ value, type: typeof r.tipo_telefone === "string" && r.tipo_telefone ? r.tipo_telefone : null });
    }
    return out;
  } catch (e) { errors.push(`Telefones: ${(e as Error).message}`); return []; }
}

export type EoxFetched = { f: EoxFound; record: string | null; by: "cnpj" | "código"; copies: number; errors: string[]; counts: { fields: number; contacts: number; phoneRows: number } };
/** Busca e interpreta o cadastro, sem gravar nada. null = a EOX não tem o cliente. */
export async function eoxFetch(cnpj: string, code: string | null, opts: ConsultOptions): Promise<EoxFetched | null> {
  const cfg = await loadEox();
  return withEox(cfg, async (s) => {
    const hit = await fetchAccount(s, cnpj, code);
    if (!hit) return null;
    const errors: string[] = [];
    const wsId = String(hit.row.id);
    const [labels, contacts, phoneRows] = await Promise.all([labelsOf(s, errors), opts.people ? fetchContacts(s, wsId, errors) : [], opts.phoneList ? fetchPhoneRows(s, wsId, errors) : []]);
    return { f: mapAccount(hit.row, labels, contacts, phoneRows, opts), record: recordOf(wsId), by: hit.by, copies: hit.copies, errors, counts: { fields: Object.keys(hit.row).length, contacts: contacts.length, phoneRows: phoneRows.length } };
  });
}

/** Grava no lead só o que está vazio (o que a pessoa digitou nunca é trocado) e soma telefones, e-mails e pessoas novos. */
async function apply(leadId: number, f: EoxFound, record: string | null, o: ConsultOptions, userId: number | null): Promise<Pick<EoxConsult, "newPhones" | "newEmails" | "people" | "filled">> {
  let newPhones = 0, newEmails = 0, people = 0, filled = 0;
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(leads).where(eq(leads.id, leadId));
    if (!cur) return;
    const blank = (v: string | null | undefined) => !v?.trim();
    const set: Partial<typeof leads.$inferInsert> = {};
    const fill = <K extends "site" | "facebook" | "linkedin" | "address" | "neighborhood" | "zip" | "city" | "uf" | "contactName" | "email" | "stateReg">(k: K, v: string | null) => { if (v && blank(cur[k] as string | null)) { (set as Record<string, unknown>)[k] = v; filled++; } };
    if (o.address) { fill("address", f.address); fill("neighborhood", f.neighborhood); fill("zip", f.zip); fill("city", f.city); fill("uf", f.uf); }
    if (o.social) { fill("site", f.site); fill("facebook", f.facebook); fill("linkedin", f.linkedin); }
    if (o.fiscal) fill("stateReg", f.stateReg);
    if (o.people) fill("contactName", f.contactName);
    if (o.emails) fill("email", f.emails[0] ?? null);
    /* perfil na EOX: todo lead achado ganha o Código (record= do link) e o ID EOX, sem trocar um Código que já seja válido */
    if (record && (!isRecordId(cur.eoxId) || cur.eoxId === cur.eoxCode)) { set.eoxId = record; filled++; }
    if (f.code && blank(cur.eoxCode)) { set.eoxCode = f.code; filled++; }
    const info = o.info ? { ...(cur.eoxInfo ?? {}), ...f.info } : cur.eoxInfo;
    await tx.update(leads).set({ ...set, eoxInfo: info, eoxSyncedAt: new Date(), eoxCheckedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId));

    if (o.people) for (const p of f.people) {
      const [dup] = await tx.select({ id: leadPeople.id }).from(leadPeople).where(and(eq(leadPeople.leadId, leadId), sql`lower(btrim(${leadPeople.name})) = ${p.name.toLowerCase()}`)).limit(1);
      let pid = dup?.id;
      if (!pid) { const [r] = await tx.insert(leadPeople).values({ leadId, name: p.name, roleTitle: p.title, source: "eox" }).returning({ id: leadPeople.id }); pid = r.id; people++; }
      for (const v of p.phones) { const r = await tx.insert(leadChannels).values({ leadId, personId: pid, kind: "phone", value: v, label: f.phoneKinds[v] ?? null, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newPhones += r.length; }
      for (const v of p.emails) { const r = await tx.insert(leadChannels).values({ leadId, personId: pid, kind: "email", value: v, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newEmails += r.length; }
    }
    if (o.phones || o.phoneList) for (const v of f.phones) { const r = await tx.insert(leadChannels).values({ leadId, kind: "phone", value: v, label: f.phoneKinds[v] ?? null, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newPhones += r.length; }
    if (o.emails) for (const v of f.emails) { const r = await tx.insert(leadChannels).values({ leadId, kind: "email", value: v, origin: "eox" }).onConflictDoNothing().returning({ id: leadChannels.id }); newEmails += r.length; }
    await logAudit(tx, { userId, leadId, entity: "lead", action: "atualizou dados pela EOX", field: "Consulta EOX", oldValue: cur.eoxId, newValue: record, meta: { telefonesNovos: newPhones, emailsNovos: newEmails, pessoasNovas: people, camposPreenchidos: filled } });
  });
  return { newPhones, newEmails, people, filled };
}

/** Procura o lead na EOX (por CNPJ e Código do cliente), traz o cadastro, os contatos e os telefones e completa o que falta. Registra no histórico. */
export async function eoxConsultLead(leadId: number, userId: number | null = null, origin: EoxOrigin = "manual", optsIn?: ConsultOptions): Promise<EoxConsult> {
  const t0 = Date.now();
  const r = await core(leadId, userId, optsIn ?? (await loadConsultOptions())).catch((e) => none(`erro: ${e instanceof Error ? e.message : "desconhecido"}`));
  try { await db.insert(eoxLog).values({ leadId, origin, ok: r.ok, ms: Date.now() - t0, userId, phones: r.newPhones, emails: r.newEmails, people: r.people, filled: r.filled, why: r.why ? r.why.slice(0, 300) : null }); } catch { /* o histórico nunca derruba a consulta */ }
  return r;
}

async function core(leadId: number, userId: number | null, o: ConsultOptions): Promise<EoxConsult> {
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return none("integração com a EOX desligada ou incompleta (Admin > EOX > Conexão)");
  const [l] = await db.select({ cnpj: leads.cnpj, code: leads.eoxCode }).from(leads).where(eq(leads.id, leadId));
  if (!l) return none("lead não encontrado", true);
  if (digitsOf(l.cnpj).length !== 14 && !(l.code && cfg.codeField)) return none("o lead não tem CNPJ nem ID EOX para procurar", true);
  let found: EoxFetched | null;
  try { found = await eoxFetch(l.cnpj, l.code, o); } catch (e) { return none(`a EOX não respondeu: ${(e as Error).message}`); }
  if (!found) {
    await db.update(leads).set({ eoxTriedAt: new Date(Date.now() + 7 * 864e5) }).where(eq(leads.id, leadId)); // a EOX não conhece: não volta à fila por 7 dias
    return none("a EOX não tem cadastro com esse CNPJ/ID", true);
  }
  const done = await apply(leadId, found.f, found.record, o, userId);
  return { ok: true, why: null, record: found.record, ...done };
}

export type EoxPreview = { ok: boolean; message: string; record?: string; link?: string; by?: string; copies?: number; counts?: EoxFetched["counts"]; errors?: string[]; found?: EoxFound };
/** Teste do Adm: consulta um CNPJ (ou o ID EOX) e mostra o que a EOX devolveu e o que seria gravado, sem gravar nada. */
export async function eoxPreview(query: string): Promise<EoxPreview> {
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return { ok: false, message: "Integração com a EOX desligada ou incompleta (Admin > EOX > Conexão)." };
  const d = digitsOf(query);
  const o = await loadConsultOptions();
  try {
    const r = d.length === 14 ? await eoxFetch(d, null, o) : await eoxFetch("", d || null, o);
    if (!r) return { ok: false, message: "A EOX não tem cadastro com esse CNPJ/ID EOX." };
    return { ok: true, message: `Achou na EOX (por ${r.by}).`, record: r.record ?? undefined, link: r.record ? eoxLink(cfg.baseUrl, "Accounts", r.record) : undefined, by: r.by, copies: r.copies, counts: r.counts, errors: r.errors, found: r.f };
  } catch (e) { return { ok: false, message: `A EOX não respondeu: ${(e as Error).message}` }; }
}
