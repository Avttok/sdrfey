"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, importBatches } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";

export type EditResult = { ok: boolean; message: string };
const schema = z.object({
  id: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(160),
  /** Passa todos os leads do lote para este tipo (Prospecção ou Inativo). Vazio = não mexe. */
  leadKind: z.enum(["prospect", "inativo"]).nullable(),
  /** Origem gravada nos leads do lote. null = não mexe; "" = limpa. */
  source: z.string().trim().max(80).nullable(),
});

/** Só o Adm: renomeia a importação já feita e, se pedir, muda o tipo e a origem de todos os leads que ela criou. */
export async function editImportBatchAction(input: z.infer<typeof schema>): Promise<EditResult> {
  const me = await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, message: "Confira os campos." };
  const d = p.data;
  const [b] = await db.select().from(importBatches).where(eq(importBatches.id, d.id));
  if (!b) return { ok: false, message: "Importação não encontrada." };
  const isLeads = b.kind === "leads" || b.kind === "inativos";
  let changed = 0;
  await db.transaction(async (tx) => {
    const sets = [];
    if (isLeads && d.leadKind) sets.push(sql`kind = ${d.leadKind}`);
    if (isLeads && d.source !== null) sets.push(sql`source = ${d.source || null}`);
    if (sets.length) {
      const r = await tx.execute<{ id: number }>(sql`update leads set ${sql.join(sets, sql`, `)}, updated_at = now() where import_batch_id = ${d.id} returning id`);
      changed = r.length;
    }
    await tx.update(importBatches).set({ fileName: d.fileName, ...(isLeads && d.leadKind ? { kind: d.leadKind === "inativo" ? "inativos" : "leads" } : {}) }).where(eq(importBatches.id, d.id));
  });
  const what = [d.fileName !== b.fileName ? `nome “${b.fileName}” → “${d.fileName}”` : "", isLeads && d.leadKind ? `tipo dos leads → ${d.leadKind === "inativo" ? "Inativo" : "Prospecção"}` : "", isLeads && d.source !== null ? `origem → ${d.source || "vazia"}` : ""].filter(Boolean).join("; ");
  await logAudit(db, { userId: me.id, entity: "setting", action: `editou a importação #${d.id}`, field: `${what || "sem mudanças"}${changed ? ` (${changed} leads)` : ""}` });
  revalidatePath("/admin/importar"); revalidatePath("/admin/eox"); revalidatePath("/leads");
  return { ok: true, message: changed ? `Importação atualizada e ${changed} lead(s) ajustado(s).` : "Importação atualizada." };
}
