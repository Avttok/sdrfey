"use server";

import { sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { CONFIRM_WORD, NUKE_WORD, PURGE_CATEGORIES, PURGE_SQL as TABLE, USER_PURGE, type PurgeKey, type RecordKind, type UserPurgeKey } from "./purge-spec";

const fail = (message: string): ActionResult => ({ ok: false, message });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const filterSchema = z.object({ scope: z.enum(["all", "test"]), before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });

function whereOf(key: PurgeKey, f: { scope: "all" | "test"; before: string | null }): SQL {
  const t = TABLE[key];
  const parts: SQL[] = [];
  if (f.scope === "test" && t.test) parts.push(sql.raw(t.test));
  if (f.before && t.time) parts.push(sql`${sql.raw(t.time)} < ${new Date(`${f.before}T00:00:00-03:00`).toISOString()}::timestamptz`);
  return parts.length ? sql`where ${sql.join(parts, sql` and `)}` : sql``;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function del(tx: Tx, table: string, where: SQL): Promise<number> {
  const [r] = await tx.execute<{ n: number }>(sql`with d as (delete from ${sql.raw(table)} ${where} returning 1) select count(*)::int as n from d`);
  return r?.n ?? 0;
}

const revalidateAll = () => {
  for (const p of ["/leads", "/negociacoes", "/visitas", "/painel", "/metas", "/metas-vendas", "/historico", "/historico-vendas", "/registro", "/atender", "/admin/apagar"]) revalidatePath(p);
};

/** Apaga uma categoria inteira, ou só o que é de teste, ou só o que for anterior a uma data. */
export async function purgeCategoryAction(input: { key: PurgeKey; scope: "all" | "test"; before: string | null; confirm: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const cat = PURGE_CATEGORIES.find((c) => c.key === input.key);
  const f = filterSchema.safeParse({ scope: input.scope, before: input.before || null });
  if (!cat || !f.success) return fail("Pedido inválido.");
  if (input.confirm.trim().toUpperCase() !== CONFIRM_WORD) return fail(`Digite ${CONFIRM_WORD} para confirmar.`);
  if (f.data.scope === "test" && !cat.test) return fail("Esta categoria não tem dados de teste.");
  if (f.data.before && !cat.time) return fail("Esta categoria não aceita filtro por data.");
  const where = whereOf(cat.key, f.data);
  const n = await db.transaction(async (tx) => {
    const n = await del(tx, TABLE[cat.key].table, where);
    if (cat.key === "chat" && f.data.scope === "all" && !f.data.before) await del(tx, "chat_reads", sql``);
    if (cat.key === "coins") await del(tx, "shop_purchases", f.data.before ? sql`where at < ${new Date(`${f.data.before}T00:00:00-03:00`).toISOString()}::timestamptz` : sql``);
    await logAudit(tx, { userId: me.id, entity: "purge", action: "apagou categoria", field: cat.label, newValue: `${n} registro(s)`, meta: { categoria: cat.key, escopo: f.data.scope === "test" ? "só de teste" : "tudo", anterioresA: f.data.before, apagados: n } });
    return n;
  });
  revalidateAll();
  return { ok: true, message: n ? `${cat.label}: ${plural(n, "registro apagado", "registros apagados")}.` : `${cat.label}: não havia nada para apagar nesse filtro.` };
}

const USER_SQL: Record<UserPurgeKey, { table: string; col: string }> = {
  interactions: { table: "interactions", col: "user_id" },
  sessions: { table: "attendance_sessions", col: "user_id" },
  visits: { table: "visits", col: "user_id" },
  dealsSdr: { table: "deals", col: "sdr_id" },
  dealsSeller: { table: "deals", col: "seller_id" },
  chat: { table: "chat_messages", col: "user_id" },
  audit: { table: "audit_log", col: "user_id" },
};

/** Apaga o que UMA pessoa produziu (uma coisa só ou tudo). A conta dela continua (excluir a conta fica em Usuários). */
export async function purgeUserDataAction(input: { userId: number; what: UserPurgeKey | "all"; confirm: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  if (input.confirm.trim().toUpperCase() !== CONFIRM_WORD) return fail(`Digite ${CONFIRM_WORD} para confirmar.`);
  const [u] = await db.execute<{ id: number; name: string }>(sql`select id, name from users where id = ${input.userId}`);
  if (!u) return fail("Usuário não encontrado.");
  const keys: UserPurgeKey[] = input.what === "all" ? USER_PURGE.map((k) => k.key) : USER_PURGE.some((k) => k.key === input.what) ? [input.what as UserPurgeKey] : [];
  if (!keys.length) return fail("Pedido inválido.");
  const done: Record<string, number> = {};
  await db.transaction(async (tx) => {
    for (const k of keys) { const s = USER_SQL[k]; done[k] = await del(tx, s.table, sql`where ${sql.raw(s.col)} = ${u.id}`); }
    const total = Object.values(done).reduce((a, b) => a + b, 0);
    await logAudit(tx, { userId: me.id, entity: "purge", action: input.what === "all" ? "apagou tudo de um usuário" : "apagou dados de um usuário", field: u.name, newValue: `${total} registro(s)`, meta: { usuario: u.name, usuarioId: u.id, apagados: done } });
  });
  revalidateAll();
  const total = Object.values(done).reduce((a, b) => a + b, 0);
  return { ok: true, message: total ? `${u.name}: ${plural(total, "registro apagado", "registros apagados")}.` : `${u.name}: não havia nada para apagar.` };
}

const RECORD: Record<Exclude<RecordKind, "tag">, { table: string; label: string }> = {
  lead: { table: "leads", label: "Lead" }, deal: { table: "deals", label: "Negociação" }, quote: { table: "deal_quotes", label: "Cotação" }, visit: { table: "visits", label: "Visita" },
  interaction: { table: "interactions", label: "Interação" }, session: { table: "attendance_sessions", label: "Atendimento" }, channel: { table: "lead_channels", label: "Contato" },
  person: { table: "lead_people", label: "Pessoa" }, chat: { table: "chat_messages", label: "Mensagem" }, audit: { table: "audit_log", label: "Registro" },
};
const BULKY = ["cnpj_data", "brasilapi_data", "receitaws_data"];

/** Apaga UM registro. `id2` só para tag (lead + tag). Guarda uma foto do que existia no Registro. */
export async function deleteRecordAction(input: { kind: RecordKind; id: number; id2?: number; withHistory?: boolean }): Promise<ActionResult> {
  const me = await requireAdmin();
  const { kind, id } = input;
  if (!Number.isInteger(id)) return fail("Pedido inválido.");
  let table: string, label: string, where: SQL, leadId: number | null = null;
  if (kind === "tag") {
    if (!Number.isInteger(input.id2)) return fail("Pedido inválido.");
    table = "lead_tags"; label = "Tag"; where = sql`where lead_id = ${id} and tag_id = ${input.id2!}`; leadId = id;
  } else if (RECORD[kind]) { table = RECORD[kind].table; label = RECORD[kind].label; where = sql`where id = ${id}`; }
  else return fail("Pedido inválido.");
  const [snap] = await db.execute<{ r: Record<string, unknown> }>(sql`select to_jsonb(t) as r from ${sql.raw(table)} t ${where}`);
  if (!snap) return fail("Esse registro não existe mais.");
  const row = { ...snap.r };
  for (const k of BULKY) delete row[k];
  if (kind === "lead") leadId = id; else if (typeof row.lead_id === "number") leadId = row.lead_id;
  else if (kind === "quote" || kind === "deal") {
    const dealId = kind === "deal" ? id : (row.deal_id as number);
    const [d] = await db.execute<{ lead_id: number }>(sql`select lead_id from deals where id = ${dealId}`);
    leadId = d?.lead_id ?? null;
  }
  await db.transaction(async (tx) => {
    const n = await del(tx, table, where);
    if (kind === "lead" && input.withHistory) await del(tx, "audit_log", sql`where lead_id = ${id}`);
    if (n) await logAudit(tx, { userId: me.id, leadId: kind === "lead" && input.withHistory ? null : leadId, entity: "purge", action: `apagou ${label.toLowerCase()}`, field: label, oldValue: kind === "lead" ? String(row.company ?? "") : null, meta: { tipo: kind, id, foto: row } });
  });
  revalidateAll();
  if (leadId && kind !== "lead") revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: `${label} apagado.` };
}

/** Zera os dados de trabalho (leads e tudo ligado a eles + chat). Mantém usuários, configurações, tags e modelos de e-mail. */
export async function purgeEverythingAction(input: { confirm: string; audit: boolean; catalog: boolean }): Promise<ActionResult> {
  const me = await requireAdmin();
  if (input.confirm.trim().toUpperCase() !== NUKE_WORD) return fail(`Digite ${NUKE_WORD} para confirmar.`);
  const done: Record<string, number> = {};
  await db.transaction(async (tx) => {
    done.leads = await del(tx, "leads", sql``);
    done.chat = await del(tx, "chat_messages", sql``);
    await del(tx, "chat_reads", sql``);
    done.visitas = await del(tx, "visits", sql``);
    done.interacoes = await del(tx, "interactions", sql``);
    done.sessoes = await del(tx, "attendance_sessions", sql``);
    done.negociacoes = await del(tx, "deals", sql``);
    if (input.catalog) { done.representantes = await del(tx, "reps", sql``); done.produtos = await del(tx, "products", sql``); done.condicoes = await del(tx, "payment_terms", sql``); }
    if (input.audit) done.registro = await del(tx, "audit_log", sql``);
    await logAudit(tx, { userId: me.id, entity: "purge", action: "zerou o sistema", field: "Dados de trabalho", newValue: `${done.leads} lead(s)`, meta: { apagados: done, registro: input.audit, catalogo: input.catalog } });
  });
  revalidateAll();
  return { ok: true, message: `Sistema zerado: ${plural(done.leads, "lead apagado", "leads apagados")} e tudo que dependia deles.` };
}
