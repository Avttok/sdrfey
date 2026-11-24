import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, leads, settings, type Db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { invalidateSettings, settingValue } from "@/modules/settings/get";
import { digitsOf, EOX_FALLBACK_BASE, eoxAccountsPage, eoxFindByCnpj, eoxFindByCode, eoxLink, eoxLogin, type EoxSession } from "./client";
import { EOX_KEY, eoxReady, parseEox } from "./config";

export const EOX_SYNC_KEY = "eox_sync";
export type EoxSyncState = { offset: number; at: string | null; lastLinked: number; lastScanned: number; round: number; /** último lead conferido na busca direta */ cursor: number };
export const EOX_SYNC_DEFAULT: EoxSyncState = { offset: 0, at: null, lastLinked: 0, lastScanned: 0, round: 0, cursor: 0 };

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
/**
 * Código EOX de verdade (o record= do perfil) tem 7 dígitos ou mais; o ID EOX (ex.: 117805) é menor e só serve para achar o registro.
 * Um valor menor, ou igual ao ID EOX do próprio lead, é o ID EOX gravado no lugar errado e não pode ir para link nem qualificação.
 */
export const isRecordId = (v: string | null | undefined): v is string => !!v && /^\d{7,}$/.test(v.trim());
/** SQL: o lead não tem Código EOX utilizável (vazio, curto demais ou igual ao ID EOX). */
export const needsRecordSql = sql`(${leads.eoxId} is null or ${leads.eoxId} !~ '^\\d{7,}$' or ${leads.eoxId} = ${leads.eoxCode})`;
export const eoxProfileUrl = (base: string, id: string | null | undefined) => (isRecordId(id) ? eoxLink(base, "Accounts", id) : null);

/**
 * Grava o Código EOX (o record=) nos leads que ainda não têm. Acha o lead pelo CNPJ e, se não achar, pelo ID EOX.
 * Não troca um Código válido que já existe; só preenche o vazio ou corrige o ID EOX que foi parar no lugar dele. Devolve quantos gravou.
 */
export async function linkLeads(d: Db, byCnpj: Map<string, string>, byCode: Map<string, string>, userId: number | null): Promise<number> {
  let n = 0;
  const apply = async (rows: { id: number; rec: string }[]) => {
    for (const l of rows) {
      await d.transaction(async (tx) => {
        const [cur] = await tx.select({ eoxId: leads.eoxId }).from(leads).where(eq(leads.id, l.id));
        const r = await tx.update(leads).set({ eoxId: l.rec, updatedAt: new Date() }).where(and(eq(leads.id, l.id), needsRecordSql)).returning({ id: leads.id });
        if (r.length) { n++; await logAudit(tx, { userId, leadId: l.id, entity: "lead", action: "alterou", field: "Código EOX", oldValue: cur?.eoxId ?? null, newValue: l.rec, meta: { automatico: true } }); }
      });
    }
  };
  if (byCnpj.size) {
    const todo = await d.select({ id: leads.id, cnpj: leads.cnpj }).from(leads).where(and(needsRecordSql, inArray(sql`regexp_replace(${leads.cnpj}, '\\D', '', 'g')`, [...byCnpj.keys()])));
    await apply(todo.flatMap((l) => { const rec = byCnpj.get(digitsOf(l.cnpj)); return rec ? [{ id: l.id, rec }] : []; }));
  }
  if (byCode.size) {
    const todo = await d.select({ id: leads.id, code: leads.eoxCode }).from(leads).where(and(needsRecordSql, inArray(leads.eoxCode, [...byCode.keys()])));
    await apply(todo.flatMap((l) => { const rec = l.code ? byCode.get(l.code) : null; return rec ? [{ id: l.id, rec }] : []; }));
  }
  return n;
}

/**
 * Busca direta: para cada lead sem Código EOX pergunta à EOX pelo ID EOX e, se não achar, pelo CNPJ (5 perguntas ao mesmo tempo).
 * Anda por ordem de lead e guarda onde parou, então leads que a EOX não conhece não são perguntados de novo na mesma rodada.
 */
export async function lookupMissingIds(d: Db, s: EoxSession, deadline: number, cursor: number, userId: number | null): Promise<{ linked: number; checked: number; cursor: number; done: boolean }> {
  let linked = 0, checked = 0, cur = cursor;
  while (Date.now() < deadline) {
    const batch = await d.select({ id: leads.id, cnpj: leads.cnpj, code: leads.eoxCode }).from(leads).where(and(needsRecordSql, sql`${leads.id} > ${cur}`, eq(leads.isTest, false))).orderBy(leads.id).limit(100);
    if (!batch.length) return { linked, checked, cursor: 0, done: true };
    for (let i = 0; i < batch.length && Date.now() < deadline; i += 5) {
      const group = batch.slice(i, i + 5);
      const found = await Promise.all(group.map(async (l) => {
        try { return (l.code ? await eoxFindByCode(s, l.code) : null) ?? (await eoxFindByCnpj(s, l.cnpj)); } catch { return null; }
      }));
      const m = new Map<string, string>();
      group.forEach((l, k) => { if (found[k]) m.set(digitsOf(l.cnpj), found[k]!); });
      if (m.size) linked += await linkLeads(d, m, new Map(), userId);
      checked += group.length; cur = group[group.length - 1].id;
    }
  }
  return { linked, checked, cursor: cur, done: false };
}

/**
 * Varre os cadastros da EOX e preenche o link nos leads que têm o mesmo CNPJ.
 * Continua de onde parou (a API entrega 100 por vez); ao chegar no fim volta ao começo na próxima rodada.
 */
export async function syncEoxLinks(opts: { budgetMs?: number; userId?: number | null; session?: EoxSession; database?: Db } = {}): Promise<{ ok: boolean; message: string; linked: number; scanned: number; done: boolean }> {
  const d = opts.database ?? db;
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return { ok: false, message: "Integração com a EOX desligada ou incompleta.", linked: 0, scanned: 0, done: false };
  const total = opts.budgetMs ?? 45_000;
  const deadline = Date.now() + total;
  const st = await loadSyncState();
  let s: EoxSession;
  try { s = opts.session ?? (await eoxLogin(cfg)); } catch (e) { return { ok: false, message: `Não entrei na EOX: ${(e as Error).message}`, linked: 0, scanned: 0, done: false }; }
  let offset = st.offset, linked = 0, scanned = 0, done = false, cursor = st.cursor;
  try {
    // 1) busca direta, lead por lead (metade do tempo); 2) varredura geral da EOX com o resto
    const t = await lookupMissingIds(d, s, Date.now() + total / 2, cursor, opts.userId ?? null);
    linked += t.linked; scanned += t.checked; cursor = t.cursor;
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
    await saveSyncState(d, { ...st, offset, cursor, at: new Date().toISOString(), lastLinked: linked, lastScanned: scanned });
    return { ok: false, message: `A EOX parou de responder: ${(e as Error).message}`, linked, scanned, done: false };
  }
  await saveSyncState(d, { offset, cursor, at: new Date().toISOString(), lastLinked: linked, lastScanned: scanned, round: st.round + (done ? 1 : 0) });
  return { ok: true, message: done ? `Rodada completa: ${linked} leads receberam o link.` : `${linked} leads receberam o link; continua de onde parou na próxima execução.`, linked, scanned, done };
}

/** Na hora de ligar: se o lead não tem Código EOX, procura só ele (por ID EOX, depois por CNPJ) e grava. null se a EOX não tem esse cliente. */
export async function ensureEoxId(leadId: number, userId: number | null): Promise<string | null> {
  const cfg = await loadEox();
  if (!eoxReady(cfg)) return null;
  const [l] = await db.select({ cnpj: leads.cnpj, eoxId: leads.eoxId, eoxCode: leads.eoxCode }).from(leads).where(eq(leads.id, leadId));
  if (!l) return null;
  if (isRecordId(l.eoxId) && l.eoxId !== l.eoxCode) return l.eoxId;
  try {
    const s = await eoxLogin(cfg);
    const rec = (await eoxFindByCnpj(s, l.cnpj)) ?? (l.eoxCode ? await eoxFindByCode(s, l.eoxCode) : null);
    if (!rec) return null;
    await linkLeads(db, new Map([[digitsOf(l.cnpj), rec]]), new Map(), userId);
    return rec;
  } catch { return null; }
}

export type EoxStep = { ok: boolean; message: string; phase: "direct" | "scan"; linked: number; checked: number; done: boolean; remaining: number; total: number };

/** Quantos leads (reais) ainda não têm Código EOX, e quantos são no total. */
export async function eoxRemaining(): Promise<{ remaining: number; total: number }> {
  const [r] = await db.execute<{ remaining: number; total: number }>(sql`select count(*) filter (where eox_id is null or eox_id !~ '^\\d{7,}$' or eox_id = eox_code)::int as remaining, count(*)::int as total from leads where is_test = false`);
  return { remaining: Number(r?.remaining ?? 0), total: Number(r?.total ?? 0) };
}

/**
 * Um passo da varredura da base inteira (chamado em loop pela tela, ou pelo cron). Retoma de onde parou.
 *  - direct: pergunta à EOX por cada lead sem Código EOX (ID EOX e depois CNPJ);
 *  - scan: lê os cadastros da EOX de 100 em 100 e liga pelos CNPJs/IDs que já temos.
 */
export async function eoxStep(phase: "direct" | "scan", opts: { budgetMs?: number; userId?: number | null; restart?: boolean } = {}): Promise<EoxStep> {
  const cfg = await loadEox();
  const stat = await eoxRemaining();
  const base = { phase, linked: 0, checked: 0, done: false, ...stat };
  if (!eoxReady(cfg)) return { ...base, ok: false, message: "Integração com a EOX desligada ou incompleta." };
  let s: EoxSession;
  try { s = await eoxLogin(cfg); } catch (e) { return { ...base, ok: false, message: `Não entrei na EOX: ${(e as Error).message}` }; }
  const st = await loadSyncState();
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  let linked = 0, checked = 0, done = false;
  try {
    if (phase === "direct") {
      const t = await lookupMissingIds(db, s, deadline, opts.restart ? 0 : st.cursor, opts.userId ?? null);
      linked = t.linked; checked = t.checked; done = t.done;
      await db.insert(settings).values({ key: EOX_SYNC_KEY, value: { ...st, cursor: t.cursor, at: new Date().toISOString() } }).onConflictDoUpdate({ target: settings.key, set: { value: { ...st, cursor: t.cursor, at: new Date().toISOString() }, updatedAt: new Date() } });
    } else {
      let offset = opts.restart ? 0 : st.offset;
      while (Date.now() < deadline) {
        const { rows, end } = await eoxAccountsPage(s, offset);
        checked += rows.length; offset += 100;
        const m = new Map<string, string>(), mc = new Map<string, string>();
        for (const r of rows) {
          if (r.cnpj) { const p = m.get(r.cnpj); if (!p || Number(r.record) > Number(p)) m.set(r.cnpj, r.record); }
          if (r.code) { const p = mc.get(r.code); if (!p || Number(r.record) > Number(p)) mc.set(r.code, r.record); }
        }
        linked += await linkLeads(db, m, mc, opts.userId ?? null);
        // quem já tem o Código mas não tem o ID EOX recebe o ID que a EOX informa
        const codes = rows.filter((r) => r.code);
        if (codes.length) await db.execute(sql`update leads l set eox_code = v.code from (values ${sql.join(codes.map((r) => sql`(${r.record}::text, ${r.code}::text)`), sql`, `)}) as v(rec, code) where l.eox_id = v.rec and l.eox_code is null`);
        if (end) { done = true; offset = 0; break; }
      }
      const v = { ...st, offset, at: new Date().toISOString(), round: st.round + (done ? 1 : 0) };
      await db.insert(settings).values({ key: EOX_SYNC_KEY, value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v, updatedAt: new Date() } });
    }
  } catch (e) { return { ...base, ok: false, linked, checked, message: `A EOX parou de responder: ${(e as Error).message}` }; }
  invalidateSettings();
  const after = await eoxRemaining();
  return { ok: true, phase, linked, checked, done, ...after, message: done ? "Varredura completa." : "Continua…" };
}

/**
 * Código EOX (o "record" do cadastro) de quem está sendo ligado: pelo lead, ou pelo telefone quando não se sabe o lead.
 * Usa o que já está guardado e, se faltar, pergunta à EOX (CNPJ e código do cliente). Nunca lança erro.
 */
export async function eoxRecordForCall(userId: number | null, digits: string, leadId?: number | null): Promise<{ record: string | null; leadId: number | null }> {
  try {
    let id = Number.isInteger(leadId) ? (leadId as number) : null;
    if (id == null) {
      const key = digits.replace(/\D/g, "").slice(-8);
      if (key.length === 8) {
        const rows = await db.execute<{ id: number }>(sql`
          select l.id from leads l where l.is_test = false and (
            exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and right(regexp_replace(c.value, '\\D', '', 'g'), 8) = ${key})
            or exists (select 1 from unnest(l.phones) p where right(regexp_replace(p, '\\D', '', 'g'), 8) = ${key}))
          order by (l.eox_id ~ '^\\d{7,}$') desc nulls last, l.times_served desc, l.id limit 1`);
        id = rows[0]?.id ?? null;
      }
    }
    if (id == null) return { record: null, leadId: null };
    const record = await ensureEoxId(id, userId);
    return { record: isRecordId(record) ? record : null, leadId: id };
  } catch { return { record: null, leadId: null }; }
}
