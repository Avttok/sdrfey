import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/modules/audit/log";

/**
 * Remove o que é temporário e se refaz sozinho (nada de leads, negociações ou Registro). Usado pela "Limpeza rápida" do Adm
 * e pela tarefa diária. Devolve quantos registros saíram de cada lugar.
 */
export async function cleanTemp(db: DbOrTx): Promise<Record<string, number>> {
  const run = async (label: string, q: ReturnType<typeof sql>) => {
    const [r] = await db.execute<{ n: number }>(sql`with d as (${q} returning 1) select count(*)::int as n from d`);
    return [label, r?.n ?? 0] as const;
  };
  const rows = await Promise.all([
    run("capturas do Ao vivo", sql`delete from live_snaps`),
    run("pulos vencidos", sql`delete from lead_skips where until < now()`),
    run("notificações lidas", sql`delete from notifications where read_at is not null and read_at < now() - interval '30 days'`),
    run("consultas de CNPJ antigas", sql`delete from enrich_log where at < now() - interval '90 days'`),
    run("presença antiga", sql`delete from presence where last_seen_at < now() - interval '1 day'`),
    run("permissões de Ao vivo vencidas", sql`delete from live_watch where until < now()`),
  ]);
  return Object.fromEntries(rows);
}
