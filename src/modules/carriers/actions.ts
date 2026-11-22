"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { carriers, db, importBatches } from "@/db";
import { isMode } from "@/config/carriers";
import { UFS } from "@/config/lists";
import { logAudit } from "@/modules/audit/log";
import { requirePerm } from "@/modules/auth/guard";
import { decodeCsv, parseCsv } from "@/modules/import/csv";
import { commonChecks, CARRIER_LABELS, inspectFile, type FileInsight } from "@/modules/import/insight";
import { getSettings } from "@/modules/settings/get";
import type { ActionResult } from "@/modules/leads/actions";
import { CARRIER_COLUMNS, parseCarrierRows } from "./parse";

const fail = (message: string): ActionResult => ({ ok: false, message });
const refresh = () => revalidatePath("/transportadoras");
const MAX_BYTES = 2 * 1024 * 1024;

const rowSchema = z.object({
  id: z.number().int().optional(),
  uf: z.string().refine((u) => UFS.includes(u), "UF inválida."),
  mode: z.string().refine(isMode, "Tipo deve ser CIF, FOB ou RED."),
  name: z.string().trim().min(2, "Informe o nome da transportadora.").max(80),
  capitalPct: z.number().min(0).max(100).nullable(), interiorPct: z.number().min(0).max(100).nullable(),
  capitalDays: z.number().int().min(0).max(365).nullable(), interiorDays: z.number().int().min(0).max(365).nullable(),
  minCents: z.number().int().min(0).max(1e9).nullable(),
  contact: z.string().trim().max(120).nullable(), note: z.string().trim().max(400).nullable(), active: z.boolean(),
});

export async function saveCarrierAction(input: unknown): Promise<ActionResult> {
  const me = await requirePerm("carriers.edit");
  const p = rowSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, ...v } = p.data;
  const dup = await db.select({ id: carriers.id }).from(carriers).where(and(eq(carriers.uf, v.uf), eq(carriers.mode, v.mode), sql`upper(${carriers.name}) = upper(${v.name})`));
  if (dup.some((d) => d.id !== id)) return fail("Já existe essa transportadora neste estado e tipo de frete.");
  if (id) await db.update(carriers).set({ ...v, updatedAt: new Date() }).where(eq(carriers.id, id));
  else await db.insert(carriers).values(v);
  await logAudit(db, { userId: me.id, entity: "setting", action: id ? "alterou transportadora" : "criou transportadora", field: `${v.uf} ${v.mode} ${v.name}` });
  refresh();
  return { ok: true, message: "Transportadora salva." };
}

export async function deleteCarrierAction(id: number): Promise<ActionResult> {
  const me = await requirePerm("carriers.edit");
  const [c] = await db.delete(carriers).where(eq(carriers.id, id)).returning();
  if (!c) return fail("Transportadora não encontrada.");
  await logAudit(db, { userId: me.id, entity: "setting", action: "excluiu transportadora", field: `${c.uf} ${c.mode} ${c.name}` });
  refresh();
  return { ok: true, message: "Transportadora excluída." };
}

export type CarrierPolicy = "overwrite" | "skip" | "fill";
export type CarrierPreview = { ok: false; message: string } | { ok: true; insight: FileInsight; fileName: string; total: number; fresh: number; existing: number; warnings: string[]; rejected: number; sample: { uf: string; mode: string; name: string; capitalPct: number | null; interiorPct: number | null }[] };

const policyOf = (fd: FormData): CarrierPolicy => { const v = String(fd.get("dupPolicy") ?? ""); return v === "skip" || v === "fill" ? v : "overwrite"; };

async function read(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo." } as const;
  const cfg = await getSettings();
  if (file.size > cfg.import_max_mb * 1024 * 1024) return { error: `Arquivo grande demais (máximo ${cfg.import_max_mb} MB).` } as const;
  try {
    const { headers, rows } = parseCsv(decodeCsv(Buffer.from(await file.arrayBuffer())));
    const r = parseCarrierRows(headers, rows);
    if (r.missing.length) return { error: `Faltam colunas obrigatórias: ${r.missing.join(", ")}.` } as const;
    if (!r.drafts.length) return { error: r.warnings[0] ?? "Nenhuma transportadora encontrada no arquivo." } as const;
    const base = inspectFile({ fileName: file.name, size: file.size, headers, rows, spec: CARRIER_COLUMNS, labels: CARRIER_LABELS, optional: ["% Capital", "% Interior", "Dias Capital", "Dias Interior", "Frete mínimo", "Contato"] });
    return { error: undefined, name: file.name, base, total: rows.length, maxRows: cfg.import_max_rows, ...r } as const;
  } catch { return { error: "Não consegui ler o arquivo. Confira se é um CSV." } as const; }
}

/** 1º passo: mostra o que vai acontecer, sem gravar nada. */
export async function previewCarrierImportAction(formData: FormData): Promise<CarrierPreview> {
  await requirePerm("carriers.edit");
  const f = await read(formData);
  if (f.error !== undefined) return { ok: false, message: f.error };
  const have = new Set((await db.select({ k: sql<string>`${carriers.uf} || '|' || ${carriers.mode} || '|' || upper(${carriers.name})` }).from(carriers)).map((r) => r.k));
  const existing = f.drafts.filter((d) => have.has(`${d.uf}|${d.mode}|${d.name.toUpperCase()}`)).length;
  const rejected = f.warnings.filter((w) => /^Linha \d+/.test(w)).length;
  const insight: FileInsight = { ...f.base, checks: commonChecks(f.base, { rejected, valid: f.drafts.length }, f.maxRows) };
  return { ok: true, insight, fileName: f.name, total: f.drafts.length, existing, fresh: f.drafts.length - existing, rejected, warnings: f.warnings.slice(0, 8), sample: f.drafts.slice(0, 6).map((d) => ({ uf: d.uf, mode: d.mode, name: d.name, capitalPct: d.capitalPct, interiorPct: d.interiorPct })) };
}

/** 2º passo: grava. Quem já existe (mesmo estado, tipo e nome) segue a escolha: atualizar, ignorar ou só completar o que falta. */
export type CarrierImportResult = { ok: boolean; message: string; details?: string[] };
export async function applyCarrierImportAction(formData: FormData): Promise<CarrierImportResult> {
  const me = await requirePerm("carriers.edit");
  const f = await read(formData);
  if (f.error !== undefined) return { ok: false, message: f.error };
  const policy = policyOf(formData);
  let added = 0, updated = 0, ignored = 0;
  await db.transaction(async (tx) => {
    const cur = await tx.select().from(carriers);
    const byKey = new Map(cur.map((c) => [`${c.uf}|${c.mode}|${c.name.toUpperCase()}`, c]));
    for (const d of f.drafts) {
      const old = byKey.get(`${d.uf}|${d.mode}|${d.name.toUpperCase()}`);
      if (!old) { await tx.insert(carriers).values(d); added++; continue; }
      if (policy === "skip") { ignored++; continue; }
      const set = policy === "fill"
        ? { capitalPct: old.capitalPct ?? d.capitalPct, interiorPct: old.interiorPct ?? d.interiorPct, capitalDays: old.capitalDays ?? d.capitalDays, interiorDays: old.interiorDays ?? d.interiorDays, minCents: old.minCents ?? d.minCents, contact: old.contact || d.contact, note: old.note || d.note }
        : { capitalPct: d.capitalPct, interiorPct: d.interiorPct, capitalDays: d.capitalDays, interiorDays: d.interiorDays, minCents: d.minCents, contact: d.contact, note: d.note };
      await tx.update(carriers).set({ ...set, updatedAt: new Date() }).where(eq(carriers.id, old.id));
      updated++;
    }
    await tx.insert(importBatches).values({ kind: "carriers", fileName: f.name, userId: me.id, total: f.drafts.length, inserted: added, skipped: ignored });
  });
  await logAudit(db, { userId: me.id, entity: "import", action: "importou transportadoras", field: f.name, newValue: added + updated });
  refresh();
  return { ok: true, message: `${added} nova(s), ${updated} atualizada(s)${ignored ? `, ${ignored} ignorada(s)` : ""}.`, details: f.warnings.slice(0, 8) };
}
