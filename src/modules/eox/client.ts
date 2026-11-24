import { createHash } from "node:crypto";
import type { EoxConfig } from "./config";

type Fetch = typeof fetch;
export type EoxSession = { cfg: EoxConfig; session: string; f: Fetch };

const TIMEOUT = 15_000;

/** O "id" da API vem como "6x1293925": o número do cadastro é o que fica depois do x. */
export const recordOf = (apiId: string): string | null => /^\d+x(\d+)$/.exec(String(apiId))?.[1] ?? null;
export const eoxLink = (baseUrl: string, module: string, record: string) => `${baseUrl}/index.php?module=${module}&view=Detail&record=${record}`;
export const EOX_FALLBACK_BASE = "https://fey.vocallcontact.com.br";
export const digitsOf = (s: unknown) => String(s ?? "").replace(/\D/g, "");

async function call(f: Fetch, url: string, init?: RequestInit): Promise<unknown> {
  const r = await f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  const j = JSON.parse(await r.text()) as { success?: boolean; result?: unknown; error?: { message?: string } };
  if (!j.success) throw new Error(j.error?.message ?? "a EOX recusou o pedido");
  return j.result;
}

/** Entra na API (desafio + login com md5), como o Vtiger exige. */
export async function eoxLogin(cfg: EoxConfig, f: Fetch = fetch): Promise<EoxSession> {
  const ws = `${cfg.baseUrl}/webservice.php`;
  const ch = (await call(f, `${ws}?operation=getchallenge&username=${encodeURIComponent(cfg.username)}`)) as { token?: string };
  if (!ch.token) throw new Error("a EOX não devolveu o desafio de login");
  const accessKey = createHash("md5").update(ch.token + cfg.accessKey).digest("hex");
  const lg = (await call(f, ws, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ operation: "login", username: cfg.username, accessKey }) })) as { sessionName?: string };
  if (!lg.sessionName) throw new Error("login recusado");
  return { cfg, session: lg.sessionName, f };
}

/** Sessão guardada em memória (14 min): a conta fica "logada" e as consultas não pedem login a cada ligação. */
const sessions = new Map<string, { s: EoxSession; at: number }>();
const sessionKey = (c: EoxConfig) => createHash("md5").update(`${c.baseUrl}|${c.username}|${c.accessKey}`).digest("hex");
export async function eoxLoginCached(cfg: EoxConfig, f: Fetch = fetch): Promise<EoxSession> {
  const k = sessionKey(cfg), hit = sessions.get(k);
  if (hit && Date.now() - hit.at < 14 * 60_000) return { ...hit.s, cfg };
  const s = await eoxLogin(cfg, f);
  sessions.set(k, { s, at: Date.now() });
  return s;
}
export const eoxForget = (cfg: EoxConfig) => { sessions.delete(sessionKey(cfg)); };
/** Executa com a sessão guardada; se a EOX derrubou a sessão, entra de novo e repete uma vez. */
export async function withEox<T>(cfg: EoxConfig, fn: (s: EoxSession) => Promise<T>): Promise<T> {
  try { return await fn(await eoxLoginCached(cfg)); }
  catch (e) { eoxForget(cfg); try { return await fn(await eoxLoginCached(cfg)); } catch { throw e; } }
}

export async function eoxQuery(s: EoxSession, sql: string): Promise<Record<string, unknown>[]> {
  const u = `${s.cfg.baseUrl}/webservice.php?operation=query&sessionName=${encodeURIComponent(s.session)}&query=${encodeURIComponent(sql)}`;
  return (await call(s.f, u)) as Record<string, unknown>[];
}

/** Campos do módulo (para o Adm achar o nome do campo do CNPJ). */
export async function eoxFields(s: EoxSession): Promise<{ name: string; label: string }[]> {
  const r = (await call(s.f, `${s.cfg.baseUrl}/webservice.php?operation=describe&sessionName=${encodeURIComponent(s.session)}&elementType=${encodeURIComponent(s.cfg.module)}`)) as { fields?: { name: string; label: string }[] };
  return (r.fields ?? []).map((x) => ({ name: x.name, label: x.label }));
}

export type EoxAccount = { record: string; cnpj: string; code: string };
/** Uma página de cadastros (a API entrega no máximo 100 por vez). */
export async function eoxAccountsPage(s: EoxSession, offset: number): Promise<{ rows: EoxAccount[]; end: boolean }> {
  const rows = await eoxQuery(s, `SELECT id, ${s.cfg.cnpjField}${s.cfg.codeField ? `, ${s.cfg.codeField}` : ""} FROM ${s.cfg.module} LIMIT ${offset}, 100;`);
  const out: EoxAccount[] = [];
  for (const r of rows) {
    const record = recordOf(String(r.id)), cnpj = digitsOf(r[s.cfg.cnpjField]);
    const code = s.cfg.codeField ? String(r[s.cfg.codeField] ?? "").trim() : "";
    if (record && (cnpj.length === 14 || code)) out.push({ record, cnpj: cnpj.length === 14 ? cnpj : "", code });
  }
  return { rows: out, end: rows.length < 100 };
}

const mask = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
/** Procura um cliente pelo CNPJ (com ou sem pontuação). Se houver mais de um, fica o mais recente. */
export async function eoxFindByCnpj(s: EoxSession, cnpj: string): Promise<string | null> {
  const d = digitsOf(cnpj);
  if (d.length !== 14 || !s.cfg.cnpjField) return null;
  const rows = await eoxQuery(s, `SELECT id FROM ${s.cfg.module} WHERE ${s.cfg.cnpjField} = '${d}' OR ${s.cfg.cnpjField} = '${mask(d)}';`);
  const ids = rows.map((r) => Number(recordOf(String(r.id)))).filter((n) => n > 0);
  return ids.length ? String(Math.max(...ids)) : null;
}

/** Procura pelo Código do cliente (campo configurado). Se houver mais de um, fica o mais recente. */
export async function eoxFindByCode(s: EoxSession, code: string): Promise<string | null> {
  const c = code.trim();
  if (!s.cfg.codeField || !/^[A-Za-z0-9._-]{1,30}$/.test(c)) return null;
  const rows = await eoxQuery(s, `SELECT id FROM ${s.cfg.module} WHERE ${s.cfg.codeField} = '${c}';`);
  const ids = rows.map((r) => Number(recordOf(String(r.id)))).filter((n) => n > 0);
  return ids.length ? String(Math.max(...ids)) : null;
}
