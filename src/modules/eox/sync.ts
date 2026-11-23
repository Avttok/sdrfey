import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, leads, settings, type Db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { invalidateSettings, settingValue } from "@/modules/settings/get";
import { digitsOf, EOX_FALLBACK_BASE, eoxAccountsPage, eoxFindByCnpj, eoxFindByCode, eoxLink, eoxLogin, type EoxSession } from "./client";
import { EOX_KEY, eoxReady, parseEox } from "./config";

export const EOX_SYNC_KEY = "eox_sync";
export type EoxSyncState = { offset: number; at: string | null; lastLinked: number; lastScanned: number; round: number };
export const EOX_SYNC_DEFAULT: EoxSyncState = { offset: 0, at: null, lastLinked: 0, lastScanned: 0, round: 0 };

export const loadEox = async () => parseEox(await settingValue(EOX_KEY));
export async function loadSyncState(): Promise<EoxSyncState> {
  const v = (await settingValue<Partial<EoxSyncState>>(EOX_SYNC_KEY)) ?? {};
  return { ...EOX_SYNC_DEFAULT, ...v };
}
async function saveSyncState(d: Db, st: EoxSyncState) {
  await d.insert(settings).values({ key: EOX_SYNC_KEY, value: st }).onConflictDoUpdate({ target: settings.key, set: { value: st, updatedAt: new Date() } });
  await logAudit(d, { entity: "setting", action: "sincronizou links da EOX", field: EOX_SYNC_KEY, newValue: `${st.lastLinked} novos em ${st.lastScanned} cadastros lidos` });
  invalidateSettings();
}

/** Endereço da EOX (o da integração; se ainda não houver, o da Fey). */
export const eoxBaseUrl = async () => parseEox(await settingValue(EOX_KEY)).baseUrl || EOX_FALLBACK_BASE;
export const eoxProfileUrl = (base: string, id: string | null | undefined) => (id ? eoxLink(base, "Accounts", id) : null);

/**
 * Grava o Id da EOX (record) nos leads que ainda não têm. Acha o lead pelo CNPJ e, se não achar, pelo Código EOX.
 * Nunca troca um Id que já existe. Devolve quantos gravou.
 */
export async function linkLeads(d: Db, byCnpj: Map<string, string>, byCode: Map<string, string>, userId: number | null): Promise<number> {
  let n = 0;
  const apply = async (rows: { id: number; rec: string }[]) => {
    for (const l of rows) {
      await d.transaction(async (tx) => {
        const r = await tx.update(leads).set({ eoxId: l.rec, updatedAt: new Date() }).where(and(eq(leads.id, l.id), isNull(leads.eoxId))).returning({ id: leads.id });
        if (r.length) { n++; await logAudit(tx, { userId, leadId: l.id, entity: "lead", action: "alterou", field: "Id EOX", oldValue: null, newValue: l.rec, meta: { automatico: true } }); }
      });
    }
  };
  if (byCnpj.size) {
    const todo = await d.select({ id: leads.id, cnpj: leads.cnpj }).from(leads).where(and(isNull(leads.eoxId), inArray(sql`regexp_replace(${leads.cnpj}, '\\D', '', 'g')`, [...byCnpj.keys()])));
    await apply(todo.flatMap((l) => { const rec = byCnpj.get(digitsOf(l.cnpj)); return rec ? [{ id: l.id, rec }] : []; }));
  }
  if (byCode.size) {
    const todo = await d.select({ id: leads.id, code: leads.eoxCode }).from(leads).where(and(isNull(leads.eoxId), inArray(leads.eoxCode, [...byCode.keys()])));
    await apply(todo.flatMap((l) => { const rec = l.code ? byCode.get(l.code) : null; return rec ? [{ id: l.id, rec }] : []; }));
  }
  return n;
}

/**
 * Varre os cadastros da EOX e preenche o link nos leads que têm o mesmo CNPJ.
 * Continua de onde parou (a API entrega 100 por vez); ao chegar no fim volta ao começo na próxima rodada.
 */
export async function syncEoxLinks(opts: { budgetMs?: number; userId?: number | null; session?: EoxSession; database?: Db } = {}): Promise<{ ok: boolean; message: string; linked: number; scanned: number; done: boolean }> {
  const d = opts.database ?? db;
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return { ok: false, message: "Integração com a EOX desligada ou incompleta.", linked: 0, scanned: 0, done: false };
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const st = await loadSyncState();
  let s: EoxSession;
  try { s = opts.session ?? (await eoxLogin(cfg)); } catch (e) { return { ok: false, message: `Não entrei na EOX: ${(e as Error).message}`, linked: 0, scanned: 0, done: false }; }
  let offset = st.offset, linked = 0, scanned = 0, done = false;
  try {
    while (Date.now() < deadline) {
      const { rows, end } = await eoxAccountsPage(s, offset);
      scanned += rows.length; offset += 100;
      const m = new Map<string, string>(), mc = new Map<string, string>();
      for (const r of rows) { // repetido: o mais recente
        if (r.cnpj) { const prev = m.get(r.cnpj); if (!prev || Number(r.record) > Number(prev)) m.set(r.cnpj, r.record); }
        if (r.code) { const prev = mc.get(r.code); if (!prev || Number(r.record) > Number(prev)) mc.set(r.code, r.record); }
      }
      linked += await linkLeads(d, m, mc, opts.userId ?? null);
      if (end) { done = true; offset = 0; break; }
    }
  } catch (e) {
    await saveSyncState(d, { ...st, offset, at: new Date().toISOString(), lastLinked: linked, lastScanned: scanned });
    return { ok: false, message: `A EOX parou de responder: ${(e as Error).message}`, linked, scanned, done: false };
  }
  await saveSyncState(d, { offset, at: new Date().toISOString(), lastLinked: linked, lastScanned: scanned, round: st.round + (done ? 1 : 0) });
  return { ok: true, message: done ? `Rodada completa: ${linked} leads receberam o link.` : `${linked} leads receberam o link; continua de onde parou na próxima execução.`, linked, scanned, done };
}

/** Na hora de ligar: se o lead não tem Id da EOX, procura só ele (por CNPJ, depois por Código EOX) e grava. null se a EOX não tem esse cliente. */
export async function ensureEoxId(leadId: number, userId: number | null): Promise<string | null> {
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return null;
  const [l] = await db.select({ cnpj: leads.cnpj, eoxId: leads.eoxId, eoxCode: leads.eoxCode }).from(leads).where(eq(leads.id, leadId));
  if (!l) return null;
  if (l.eoxId) return l.eoxId;
  try {
    const s = await eoxLogin(cfg);
    const rec = (await eoxFindByCnpj(s, l.cnpj)) ?? (l.eoxCode ? await eoxFindByCode(s, l.eoxCode) : null);
    if (!rec) return null;
    await linkLeads(db, new Map([[digitsOf(l.cnpj), rec]]), new Map(), userId);
    return rec;
  } catch { return null; }
}
