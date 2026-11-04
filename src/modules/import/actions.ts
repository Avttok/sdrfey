"use server";

import { revalidatePath } from "next/cache";
import { requirePerm } from "@/modules/auth/guard";
import { decodeCsv, parseCsv } from "./csv";
import { applyLeadDrafts } from "./leads-apply";
import { parseLeadRows, type ImportReport } from "./leads-parse";
import { applyRepDrafts, parseRepRows } from "./reps";

export type ImportPreview =
  | { ok: false; message: string }
  | { ok: true; kind: "leads"; fileName: string; report: ImportReport }
  | { ok: true; kind: "reps"; fileName: string; total: number; warnings: string[] };

export type ImportResult = { ok: boolean; message: string; details?: string[] };

const MAX_BYTES = 8 * 1024 * 1024;

async function readFile(formData: FormData) {
  const file = formData.get("file");
  const kind = formData.get("kind") === "reps" ? "reps" : "leads";
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo CSV." } as const;
  if (file.size > MAX_BYTES) return { error: "Arquivo grande demais (máximo 8 MB)." } as const;
  try {
    const { headers, rows } = parseCsv(decodeCsv(Buffer.from(await file.arrayBuffer())));
    return { error: undefined, kind, headers, rows, name: file.name } as const;
  } catch {
    return { error: "Não consegui ler o arquivo. Confira se é um CSV." } as const;
  }
}

/** 1º passo: mostra o que vai acontecer, sem gravar nada. */
export async function previewImportAction(formData: FormData): Promise<ImportPreview> {
  await requirePerm("tab.importar");
  const f = await readFile(formData);
  if (f.error !== undefined) return { ok: false, message: f.error };
  if (f.kind === "leads") {
    const { report } = parseLeadRows(f.headers, f.rows);
    if (report.missingColumns.length) return { ok: false, message: `Faltam colunas obrigatórias: ${report.missingColumns.join(", ")}.` };
    return { ok: true, kind: "leads", fileName: f.name, report };
  }
  const { drafts, warnings } = parseRepRows(f.headers, f.rows);
  if (drafts.length === 0) return { ok: false, message: warnings[0] ?? "Nenhum representante encontrado no arquivo." };
  return { ok: true, kind: "reps", fileName: f.name, total: drafts.length, warnings };
}

/** 2º passo: grava. Leads novos entram; CNPJs que já existem nunca são sobrescritos. */
export async function applyImportAction(formData: FormData): Promise<ImportResult> {
  const me = await requirePerm("tab.importar");
  const f = await readFile(formData);
  if (f.error !== undefined) return { ok: false, message: f.error };
  if (f.kind === "leads") {
    const { drafts } = parseLeadRows(f.headers, f.rows);
    const r = await applyLeadDrafts(drafts, { importedBy: me.id, sourceName: f.name });
    revalidatePath("/leads");
    return { ok: true, message: `${r.inserted} lead(s) novo(s) importado(s); ${r.skippedExisting} já existiam e foram mantidos.`, details: [...r.unknownOwners.map((o) => `Responsável desconhecido ignorado: ${o}`), ...r.unknownTags.map((t) => `Tag desconhecida ignorada: ${t}`)] };
  }
  const { drafts } = parseRepRows(f.headers, f.rows);
  const r = await applyRepDrafts(drafts, { importedBy: me.id, sourceName: f.name });
  revalidatePath("/representantes");
  return { ok: true, message: `${r.total} representante(s) importado(s)/atualizado(s).`, details: r.withoutCoords ? [`${r.withoutCoords} sem coordenadas (cidade não encontrada).`] : [] };
}
