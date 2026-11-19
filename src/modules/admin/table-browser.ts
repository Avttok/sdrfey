"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";

type R = Record<string, unknown>;
const PAGE = 25;
/** Tabelas que o sistema precisa para funcionar: dá para olhar, mas não para esvaziar de uma vez. */
const NO_EMPTY = new Set(["users", "settings", "__drizzle_migrations"]);

async function tableNames(): Promise<string[]> {
  const r = await db.execute<{ t: string }>(sql`select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`);
  return r.map((x) => x.t).filter((t) => !t.startsWith("__"));
}
async function check(table: string) {
  if (!(await tableNames()).includes(table)) throw new Error("Tabela não encontrada.");
}
const show = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().replace("T", " ").slice(0, 19);
  if (typeof v === "object") return JSON.stringify(v).slice(0, 160);
  return String(v).slice(0, 160);
};

export type BrowseResult = { ok: true; table: string; columns: string[]; hasId: boolean; rows: { key: string; cells: string[] }[]; total: number; page: number; pages: number; canEmpty: boolean } | { ok: false; message: string };

/** Mostra os registros de uma tabela (25 por página, com busca em qualquer coluna). */
export async function browseTableAction(table: string, page: number, q: string): Promise<BrowseResult> {
  await requireAdmin();
  try {
    await check(table);
    const cols = (await db.execute<{ c: string }>(sql`select column_name as c from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`)).map((x) => x.c);
    const hasId = cols.includes("id");
    const needle = q.trim();
    const where = needle ? sql`where ${sql.identifier(table)}::text ilike ${"%" + needle + "%"}` : sql``;
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)} ${where}`);
    const pages = Math.max(1, Math.ceil(n / PAGE));
    const cur = Math.min(Math.max(0, page), pages - 1);
    const order = hasId ? sql`order by ${sql.identifier("id")} desc` : sql``;
    const rows = await db.execute<R>(sql`select ctid::text as "__ctid", * from ${sql.identifier(table)} ${where} ${order} limit ${PAGE} offset ${cur * PAGE}`);
    return { ok: true, table, columns: cols, hasId, total: n, page: cur, pages, canEmpty: !NO_EMPTY.has(table), rows: rows.map((r) => ({ key: hasId ? String(r.id) : String(r.__ctid), cells: cols.map((c) => show(r[c])) })) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Não consegui abrir a tabela." }; }
}

/** Apaga registros escolhidos (pelo id, ou pela posição física quando a tabela não tem id). */
export async function deleteTableRowsAction(table: string, keys: string[], hasId: boolean): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  try {
    await check(table);
    if (!keys.length) return { ok: false, message: "Nada selecionado." };
    if (table === "users" && hasId && keys.includes(String(me.id))) return { ok: false, message: "Você não pode apagar a própria conta." };
    const list = sql.join(keys.slice(0, 500).map((k) => sql`${k}`), sql`, `);
    const del = hasId
      ? await db.execute(sql`delete from ${sql.identifier(table)} where id::text in (${list}) returning 1`)
      : await db.execute(sql`delete from ${sql.identifier(table)} where ctid::text in (${list}) returning 1`);
    await logAudit(db, { userId: me.id, entity: "setting", action: "apagou registros do banco", field: table, newValue: `${del.length} registro(s)` });
    return { ok: true, message: `${del.length} registro(s) apagado(s) de ${table}.` };
  } catch (e) { return { ok: false, message: friendly(e) }; }
}

/** Esvazia a tabela inteira (registros ligados a ela também podem ser apagados pelo banco). */
export async function emptyTableAction(table: string, confirm: string): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  try {
    await check(table);
    if (NO_EMPTY.has(table)) return { ok: false, message: "Esta tabela é essencial; apague os registros um a um." };
    if (confirm.trim().toLowerCase() !== table) return { ok: false, message: `Digite o nome da tabela (${table}) para confirmar.` };
    const del = await db.execute(sql`delete from ${sql.identifier(table)} returning 1`);
    await logAudit(db, { userId: me.id, entity: "setting", action: "esvaziou tabela do banco", field: table, newValue: `${del.length} registro(s)` });
    return { ok: true, message: `${table} esvaziada (${del.length} registros).` };
  } catch (e) { return { ok: false, message: friendly(e) }; }
}

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  const c = (e as { cause?: { message?: string; code?: string } })?.cause;
  if (c?.code === "23503" || /foreign key/i.test(m + (c?.message ?? ""))) return "Outros registros dependem deste. Apague primeiro os que dependem (ou use a tabela relacionada).";
  return c?.message ?? (m || "Não deu para apagar.");
}
