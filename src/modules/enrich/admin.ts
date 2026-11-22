"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { invalidateSettings } from "@/modules/settings/get";
import { normList } from "@/config/enrich-lists";
import { enrichBatch, enrichStats, type EnrichStats } from "./batch";

export async function setAutoEnrichAction(on: boolean): Promise<{ ok: boolean }> {
  const me = await requireAdmin();
  await db.insert(settings).values({ key: "auto_enrich", value: on ? 1 : 0, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: on ? 1 : 0, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: on ? "ligou a consulta automática de CNPJ" : "desligou a consulta automática de CNPJ" });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Um lote (usado pelo botão e pelo modo contínuo da tela do Adm). */
export async function runEnrichBatchAction(size: number, list: number | string = "new"): Promise<{ tried: number; ok: number; failed: number; left: number; stats: EnrichStats }> {
  const me = await requireAdmin();
  const r = await enrichBatch(Math.min(10, Math.max(1, Math.floor(size) || 10)), 40_000, me.id, "lote", normList(list));
  return { ...r, stats: await enrichStats() };
}

export async function retryFailedEnrichAction(): Promise<{ ok: boolean }> {
  await requireAdmin();
  await db.execute(sql`update leads set enrich_tried_at = null where enriched_at is null`);
  revalidatePath("/admin/consulta-cnpj");
  return { ok: true };
}

export async function enrichLiveAction() {
  await requireAdmin();
  return (await import("./live")).liveData();
}

export async function enrichLogAction(opts: { page: number; result: "all" | "ok" | "fail"; origin: string; q: string }) {
  await requireAdmin();
  return (await import("./live")).logPage({ page: Number(opts.page) || 1, result: opts.result === "ok" || opts.result === "fail" ? opts.result : "all", origin: String(opts.origin ?? "").slice(0, 10), q: String(opts.q ?? "").slice(0, 60) });
}
