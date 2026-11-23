"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, importBatches, importUndo, leadChannels, leadPeople, leadTags } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";

export type ActionResult = { ok: boolean; message: string };

export type BatchRow = { id: number; kind: string; fileName: string; user: string | null; total: number; inserted: number; skipped: number; at: string; undoneAt: string | null; undoneCount: number | null; canUndo: boolean; touched: number };

export async function importHistory(limit = 30): Promise<BatchRow[]> {
  await requireAdmin();
  const rows = await db.execute<{ id: number; kind: string; file_name: string; user: string | null; total: number; inserted: number; skipped: number; at: string; undone_at: string | null; undone_count: number | null; touched: number; journal: boolean }>(sql`
    select b.id, b.kind, b.file_name, u.name as user, b.total, b.inserted, b.skipped, b.created_at as at, b.undone_at, b.undone_count,
      (select count(*)::int from leads l where l.import_batch_id = b.id and ${touchedSql}) as touched,
      exists (select 1 from import_undo x where x.batch_id = b.id) as journal
    from import_batches b left join users u on u.id = b.user_id order by b.created_at desc limit ${Math.min(Math.max(1, Math.floor(limit) || 30), 200)}`);
  return rows.map((r) => ({ id: r.id, kind: r.kind, fileName: r.file_name, user: r.user, total: r.total, inserted: r.inserted, skipped: r.skipped, at: new Date(r.at).toISOString(), undoneAt: r.undone_at ? new Date(r.undone_at).toISOString() : null, undoneCount: r.undone_count, canUndo: (r.kind === "leads" || r.kind === "inativos" || r.kind === "eox") && !r.undone_at && (r.inserted > 0 || r.journal), touched: r.touched }));
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
  if (b.kind === "eox") return (await import("@/modules/eox/import")).undoEoxImportAction(id);
  if (b.kind !== "leads" && b.kind !== "inativos") return { ok: false, message: "Só lotes de leads podem ser desfeitos." };
  // 1) devolve o que a importação completou em leads que já existiam (campos, telefones, contatos, tags)
  const rows = await db.select().from(importUndo).where(eq(importUndo.batchId, id));
  let restored = 0;
  const COLS: Record<string, string> = { sapCode: "sap_code", eoxId: "eox_id", eoxCode: "eox_code", sfId: "sf_id", contactName: "contact_name", roleTitle: "role_title", email: "email", notes: "notes", legacyVisit: "legacy_visit", company: "company" };
  await db.transaction(async (tx) => {
    for (const r of rows.filter((x) => x.kind === "lead_fill")) {
      const before = (r.before ?? {}) as Record<string, unknown>;
      const sets = Object.entries(before).flatMap(([k, v]) => (COLS[k] ? [sql`${sql.identifier(COLS[k])} = ${v as string | null}`] : k === "phones" ? [sql`phones = ARRAY[${sql.join(((v as string[]) ?? []).map((x) => sql`${x}`), sql`, `)}]::text[]`] : []));
      if (sets.length) { await tx.execute(sql`update leads set ${sql.join(sets, sql`, `)} where id = ${r.refId}`); restored++; }
    }
    const ids = (k: string) => rows.filter((x) => x.kind === k).map((x) => x.refId);
    if (ids("channel").length) await tx.delete(leadChannels).where(inArray(leadChannels.id, ids("channel")));
    if (ids("person").length) await tx.delete(leadPeople).where(inArray(leadPeople.id, ids("person")));
    for (const r of rows.filter((x) => x.kind === "tag_link")) await tx.delete(leadTags).where(and(eq(leadTags.leadId, r.refId), eq(leadTags.tagId, Number((r.before as { tagId: number }).tagId))));
  });
  // 2) apaga os leads novos que ninguém trabalhou
  const gone = await db.execute<{ id: number }>(sql`delete from leads l where l.import_batch_id = ${id} and not ${touchedSql} returning l.id`);
  await db.update(importBatches).set({ undoneAt: new Date(), undoneCount: gone.length + restored }).where(eq(importBatches.id, id));
  await logAudit(db, { userId: me.id, entity: "setting", action: `desfez a importação de ${b.fileName}`, field: `${gone.length} leads apagados, ${restored} leads voltaram ao que eram` });
  revalidatePath("/admin/importar");
  revalidatePath("/leads");
  const kept = b.inserted - gone.length;
  return { ok: true, message: `${gone.length} lead(s) apagado(s)${restored ? `, ${restored} voltaram ao que eram` : ""}${kept > 0 ? `; ${kept} ficaram porque já foram trabalhados` : ""}.` };
}
