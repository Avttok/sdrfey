"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { hasRole } from "@/config/roles";
import { requireUser } from "@/modules/auth/guard";
import { logAudit } from "@/modules/audit/log";

export type Level = "ok" | "warn" | "bad";
export type HealthCheck = { label: string; level: Level; detail: string };
export type DbHealth = {
  isAdmin: boolean;
  at: string;
  latencyMs: number;
  version: string | null;
  sizeBytes: number | null;
  uptimeSec: number | null;
  connections: { active: number; idle: number; idleTx: number; max: number | null } | null;
  cacheHitPct: number | null;
  xactCommit: number | null;
  xactRollback: number | null;
  deadlocks: number | null;
  tables: { name: string; rows: number; bytes: number; dead: number; lastVacuum: string | null }[];
  indexes: { total: number; bytes: number; unused: { name: string; table: string; bytes: number }[] };
  leads: { total: number; test: number; unenriched: number; noContact: number; noEmail: number; noCity: number; locked: number; owned: number; lastCreated: string | null; lastEnriched: string | null };
  system: { usersActive: number; usersOnline: number; dealsOpen: number; dealsBilled: number; dealsLost: number; quotes: number; inactiveLeads: number; shufflesToday: number; attendedToday: number; auditDay: number; lastAudit: string | null } | null;
  checks: HealthCheck[];
  errors: string[];
};

async function q<T>(errors: string[], label: string, run: () => Promise<T>): Promise<T | null> {
  try { return await run(); } catch { errors.push(label); return null; }
}
const rows = <T,>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] })?.rows ?? [])) as T[];
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Monitor de saúde do banco e do sistema: só o Adm. Cada consulta é isolada, uma falha não derruba o resto. */
export async function dbHealthAction(): Promise<{ ok: true; data: DbHealth } | { ok: false; message: string }> {
  const me = await requireUser();
  if (!me.isAdmin) return { ok: false, message: "Só o Adm vê a saúde do sistema." };
  const errors: string[] = [];

  const t0 = performance.now();
  await q(errors, "latência", () => db.execute(sql`select 1`));
  const latencyMs = Math.round(performance.now() - t0);

  const [meta, conn, stat, tbls, idxs, unused, leadsAgg, sys] = await Promise.all([
    q(errors, "versão/tamanho", async () => rows<{ v: string; size: string; up: string | null }>(await db.execute(sql`select version() as v, pg_database_size(current_database())::text as size, extract(epoch from now() - pg_postmaster_start_time())::text as up`))[0]),
    q(errors, "conexões", async () => rows<{ active: string; idle: string; idle_tx: string; max: string | null }>(await db.execute(sql`select count(*) filter (where state = 'active') as active, count(*) filter (where state = 'idle') as idle, count(*) filter (where state like 'idle in transaction%') as idle_tx, current_setting('max_connections', true) as max from pg_stat_activity where datname = current_database()`))[0]),
    q(errors, "estatísticas", async () => rows<{ hit: string | null; commit: string; rollback: string; deadlocks: string }>(await db.execute(sql`select round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2)::text as hit, xact_commit::text as commit, xact_rollback::text as rollback, deadlocks::text as deadlocks from pg_stat_database where datname = current_database()`))[0]),
    q(errors, "tabelas", async () => rows<{ name: string; n: string; bytes: string; dead: string; vac: string | null }>(await db.execute(sql`select relname as name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', schemaname, relname), false, true, '')))[1]::text as n, pg_total_relation_size(relid)::text as bytes, n_dead_tup::text as dead, greatest(last_vacuum, last_autovacuum)::text as vac from pg_stat_user_tables where left(relname, 2) <> '__' order by pg_total_relation_size(relid) desc`))),
    q(errors, "índices", async () => rows<{ total: string; bytes: string }>(await db.execute(sql`select count(*)::text as total, coalesce(sum(pg_relation_size(indexrelid)), 0)::text as bytes from pg_stat_user_indexes`))[0]),
    q(errors, "índices sem uso", async () => rows<{ name: string; tbl: string; bytes: string }>(await db.execute(sql`select s.indexrelname as name, s.relname as tbl, pg_relation_size(s.indexrelid)::text as bytes from pg_stat_user_indexes s join pg_index i on i.indexrelid = s.indexrelid where s.idx_scan = 0 and not i.indisunique and not i.indisprimary order by pg_relation_size(s.indexrelid) desc limit 6`))),
    q(errors, "leads", async () => rows<Record<string, string | null>>(await db.execute(sql`select count(*)::text as total, count(*) filter (where is_test)::text as test, count(*) filter (where not is_test and enriched_at is null)::text as unenriched, count(*) filter (where not is_test and cardinality(phones) = 0 and email is null)::text as no_contact, count(*) filter (where not is_test and email is null)::text as no_email, count(*) filter (where not is_test and city is null)::text as no_city, count(*) filter (where locked_by is not null)::text as locked, count(*) filter (where owner_id is not null)::text as owned, max(created_at)::text as last_created, max(enriched_at)::text as last_enriched from leads`))[0]),
    q(errors, "sistema", async () => rows<Record<string, string | null>>(await db.execute(sql`select
      (select count(*) from users where active)::text as users_active,
      (select count(*) from presence where last_seen_at > now() - interval '90 seconds')::text as users_online,
      (select count(*) from deals where not is_test and stage not in ('ganho','perdido'))::text as deals_open,
      (select count(*) from deals where not is_test and stage = 'ganho')::text as deals_billed,
      (select count(*) from deals where not is_test and stage = 'perdido')::text as deals_lost,
      (select count(*) from deal_quotes)::text as quotes,
      (select count(*) from leads where kind = 'inativo' and not is_test)::text as inactive,
      (select count(*) from seller_shuffles where done_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')::text as shuffles_today,
      (select count(*) from attendance_sessions where outcome = 'saved' and not is_test and saved_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')::text as attended_today,
      (select count(*) from audit_log where at > now() - interval '24 hours')::text as audit_day,
      (select max(at) from audit_log)::text as last_audit`))[0]),
  ]);

  const connections = conn ? { active: num(conn.active), idle: num(conn.idle), idleTx: num(conn.idle_tx), max: conn.max ? num(conn.max) : null } : null;
  const cacheHitPct = stat?.hit != null ? Number(stat.hit) : null;
  const tables = (tbls ?? []).map((t) => ({ name: t.name, rows: num(t.n), bytes: num(t.bytes), dead: num(t.dead), lastVacuum: t.vac }));
  const leadsOut = leadsAgg
    ? { total: num(leadsAgg.total), test: num(leadsAgg.test), unenriched: num(leadsAgg.unenriched), noContact: num(leadsAgg.no_contact), noEmail: num(leadsAgg.no_email), noCity: num(leadsAgg.no_city), locked: num(leadsAgg.locked), owned: num(leadsAgg.owned), lastCreated: leadsAgg.last_created, lastEnriched: leadsAgg.last_enriched }
    : { total: 0, test: 0, unenriched: 0, noContact: 0, noEmail: 0, noCity: 0, locked: 0, owned: 0, lastCreated: null, lastEnriched: null };

  const checks: HealthCheck[] = [];
  checks.push({ label: "Resposta do banco", level: latencyMs < 150 ? "ok" : latencyMs < 500 ? "warn" : "bad", detail: `${latencyMs} ms para uma consulta simples` });
  if (cacheHitPct != null) checks.push({ label: "Cache de leitura", level: cacheHitPct >= 95 ? "ok" : cacheHitPct >= 85 ? "warn" : "bad", detail: `${cacheHitPct}% das leituras vêm da memória` });
  if (connections) {
    const pct = connections.max ? ((connections.active + connections.idle + connections.idleTx) / connections.max) * 100 : 0;
    checks.push({ label: "Conexões", level: pct < 60 ? "ok" : pct < 85 ? "warn" : "bad", detail: `${connections.active + connections.idle + connections.idleTx}${connections.max ? ` de ${connections.max}` : ""} em uso` });
    checks.push({ label: "Transações paradas", level: connections.idleTx === 0 ? "ok" : "warn", detail: connections.idleTx === 0 ? "Nenhuma transação aberta sem uso" : `${connections.idleTx} aberta(s) sem uso` });
  }
  const deadTotal = tables.reduce((s, t) => s + t.dead, 0);
  const liveTotal = tables.reduce((s, t) => s + t.rows, 0);
  const deadPct = liveTotal ? (deadTotal / liveTotal) * 100 : 0;
  if (tbls) checks.push({ label: "Limpeza (vacuum)", level: deadTotal < 1000 || deadPct < 10 ? "ok" : deadPct < 30 ? "warn" : "bad", detail: `${deadTotal.toLocaleString("pt-BR")} linhas mortas (${deadPct.toFixed(1)}%)` });
  if (stat) checks.push({ label: "Deadlocks", level: num(stat.deadlocks) === 0 ? "ok" : "warn", detail: `${num(stat.deadlocks)} desde o início das estatísticas` });
  if (leadsAgg && leadsOut.total) {
    const pct = (leadsOut.unenriched / Math.max(1, leadsOut.total - leadsOut.test)) * 100;
    checks.push({ label: "Leads consultados", level: pct < 5 ? "ok" : pct < 30 ? "warn" : "bad", detail: `${leadsOut.unenriched.toLocaleString("pt-BR")} sem consulta de CNPJ (${pct.toFixed(1)}%)` });
    checks.push({ label: "Leads sem contato", level: leadsOut.noContact === 0 ? "ok" : "warn", detail: `${leadsOut.noContact.toLocaleString("pt-BR")} sem telefone nem e-mail` });
  }

  return {
    ok: true,
    data: {
      isAdmin: me.isAdmin, at: new Date().toISOString(), latencyMs, version: meta?.v?.split(" on ")[0] ?? null, sizeBytes: meta ? num(meta.size) : null, uptimeSec: meta?.up ? Math.round(Number(meta.up)) : null,
      connections, cacheHitPct, xactCommit: stat ? num(stat.commit) : null, xactRollback: stat ? num(stat.rollback) : null, deadlocks: stat ? num(stat.deadlocks) : null,
      tables, indexes: { total: idxs ? num(idxs.total) : 0, bytes: idxs ? num(idxs.bytes) : 0, unused: (unused ?? []).map((u) => ({ name: u.name, table: u.tbl, bytes: num(u.bytes) })) },
      leads: leadsOut, checks, errors,
      system: sys ? { usersActive: num(sys.users_active), usersOnline: num(sys.users_online), dealsOpen: num(sys.deals_open), dealsBilled: num(sys.deals_billed), dealsLost: num(sys.deals_lost), quotes: num(sys.quotes), inactiveLeads: num(sys.inactive), shufflesToday: num(sys.shuffles_today), attendedToday: num(sys.attended_today), auditDay: num(sys.audit_day), lastAudit: sys.last_audit } : null,
    },
  };
}

/** Manutenção do banco: só o Adm. Os nomes são conferidos contra o catálogo do banco antes de qualquer comando. */
export async function dbMaintenanceAction(input: { kind: "vacuum"; table?: string } | { kind: "drop_index"; name: string }): Promise<{ ok: boolean; message: string }> {
  const me = await requireUser();
  if (!me.isAdmin) return { ok: false, message: "Só o Adm pode fazer isso." };
  try {
    if (input.kind === "vacuum") {
      const names = rows<{ name: string }>(await db.execute(sql`select relname as name from pg_stat_user_tables`)).map((r) => r.name);
      const targets = input.table ? names.filter((n) => n === input.table) : names;
      if (!targets.length) return { ok: false, message: "Tabela não encontrada." };
      for (const t of targets) await db.execute(sql`vacuum (analyze) ${sql.identifier(t)}`);
      await logAudit(db, { userId: me.id, entity: "setting", action: "limpou o banco (vacuum)", field: "Banco de dados", newValue: input.table ?? "todas as tabelas" });
      return { ok: true, message: input.table ? `Tabela ${input.table} limpa.` : `${targets.length} tabelas limpas.` };
    }
    const found = rows<{ name: string }>(await db.execute(sql`select s.indexrelname as name from pg_stat_user_indexes s join pg_index i on i.indexrelid = s.indexrelid where s.idx_scan = 0 and not i.indisunique and not i.indisprimary and s.indexrelname = ${input.name}`));
    if (!found.length) return { ok: false, message: "Esse índice não existe mais, está em uso ou é obrigatório." };
    await db.execute(sql`drop index ${sql.identifier(input.name)}`);
    await logAudit(db, { userId: me.id, entity: "setting", action: "removeu índice sem uso", field: "Banco de dados", oldValue: input.name });
    return { ok: true, message: `Índice ${input.name} removido.` };
  } catch (e) {
    return { ok: false, message: `Não deu certo: ${e instanceof Error ? e.message.slice(0, 120) : "erro desconhecido"}` };
  }
}
