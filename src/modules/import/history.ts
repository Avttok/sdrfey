"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, importBatches } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";

export type ActionResult = { ok: boolean; message: string };

export type BatchRow = { id: number; kind: string; fileName: string; user: string | null; total: number; inserted: number; skipped: number; at: string; undoneAt: string | null; undoneCount: number | null; canUndo: boolean; touched: number };

export async function importHistory(limit = 30): Promise<BatchRow[]> {
  const rows = await db.execute<{ id: number; kind: string; file_name: string; user: string | null; total: number; inserted: number; skipped: number; at: string; undone_at: string | null; undone_count: number | null; touched: number }>(sql`
    select b.id, b.kind, b.file_name, u.name as user, b.total, b.inserted, b.skipped, b.created_at as at, b.undone_at, b.undone_count,
      (select count(*)::int from leads l where l.import_batch_id = b.id and ${touchedSql}) as touched
    from import_batches b left join users u on u.id = b.user_id order by b.created_at desc limit ${limit}`);
  return rows.map((r) => ({ id: r.id, kind: r.kind, fileName: r.file_name, user: r.user, total: r.total, inserted: r.inserted, skipped: r.skipped, at: new Date(r.at).toISOString(), undoneAt: r.undone_at ? new Date(r.undone_at).toISOString() : null, undoneCount: r.undone_count, canUndo: (r.kind === "leads" || r.kind === "inativos") && !r.undone_at && r.inserted > 0, touched: r.touched }));
}

/** Lead já trabalhado: tem atendimento, visita, negociação, interação, passou por shuffler ou está reservado. */
const touchedSql = sql`(l.times_served > 0 or l.times_worked > 0 or l.locked_by is not null
  or exists (select 1 from deals d where d.lead_id = l.id) or exists (select 1 from visits v where v.lead_id = l.id)
  or exists (select 1 from attendance_sessions a where a.lead_id = l.id) or exists (select 1 from interactions i where i.lead_id = l.id)
  or exists (select 1 from seller_shuffles s where s.lead_id = l.id))`;

/** Desfaz um lote de leads: apaga só os que ninguém trabalhou ainda. Os trabalhados ficam. */
export async function undoImportBatchAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [b] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  if (!b) return { ok: false, message: "Lote não encontrado." };
  if (b.undoneAt) return { ok: false, message: "Este lote já foi desfeito." };
  if (b.kind !== "leads" && b.kind !== "inativos") return { ok: false, message: "Só lotes de leads podem ser desfeitos." };
  const gone = await db.execute<{ id: number }>(sql`delete from leads l where l.import_batch_id = ${id} and not ${touchedSql} returning l.id`);
  await db.update(importBatches).set({ undoneAt: new Date(), undoneCount: gone.length }).where(eq(importBatches.id, id));
  await logAudit(db, { userId: me.id, entity: "setting", action: `desfez a importação de ${b.fileName}`, field: `${gone.length} leads apagados` });
  revalidatePath("/admin/importar");
  revalidatePath("/leads");
  const kept = b.inserted - gone.length;
  return { ok: true, message: `${gone.length} lead(s) apagado(s)${kept > 0 ? `; ${kept} ficaram porque já foram trabalhados` : ""}.` };
}
