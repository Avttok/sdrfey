"use server";

import { plural } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, importBatches } from "@/db";
import { requireAdmin } from "@/modules/auth/guard";
import { LEAD_COLUMNS, REP_COLUMNS } from "./columns";
import { commonChecks, inspectFile, LEAD_LABELS, REP_LABELS, type FileInsight } from "./insight";
import { decodeCsv, parseCsv } from "./csv";
import { headerKey } from "./normalize";
import { applyLeadDrafts } from "./leads-apply";
import { parseLeadRows, type ImportReport } from "./leads-parse";
import { applyRepDrafts, parseRepRows } from "./reps";

export type ImportPreview =
  | { ok: false; message: string }
  | { ok: true; kind: "leads"; fileName: string; report: ImportReport; insight: FileInsight; existing: number; fresh: number }
  | { ok: true; kind: "reps"; fileName: string; total: number; warnings: string[]; insight: FileInsight; existing: number; fresh: number };

export type ImportResult = { ok: boolean; message: string; details?: string[] };

const MAX_BYTES = 8 * 1024 * 1024;

async function readFile(formData: FormData) {
  const file = formData.get("file");
  const kind = formData.get("kind") === "reps" ? "reps" : "leads";
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo CSV." } as const;
  if (file.size > MAX_BYTES) return { error: "Arquivo grande demais (máximo 8 MB)." } as const;
  try {
    const { headers, rows } = parseCsv(decodeCsv(Buffer.from(await file.arrayBuffer())));
    return { error: undefined, kind, headers, rows, name: file.name, size: file.size } as const;
  } catch {
    return { error: "Não consegui ler o arquivo. Confira se é um CSV." } as const;
  }
}

/** 1º passo: mostra o que vai acontecer, sem gravar nada. */
export async function previewImportAction(formData: FormData): Promise<ImportPreview> {
  await requireAdmin();
  const f = await readFile(formData);
  if (f.error !== undefined) return { ok: false, message: f.error };
  const leadKind = formData.get("leadKind") === "inativo" ? "inativo" : "prospect";
  const looksLikeReps = ["CODSAP", "NOMEREP"].every((k) => f.headers.some((h) => headerKey(h) === k));
  const looksLikeLeads = f.headers.some((h) => headerKey(h) === "CNPJ") && f.headers.some((h) => ["EMPRESA", "RAZAOSOCIAL"].includes(headerKey(h))) && !f.headers.some((h) => headerKey(h) === "NOMEREP");
  if (f.kind === "leads") {
    const { drafts, report } = parseLeadRows(f.headers, f.rows);
    if (report.missingColumns.length) return { ok: false, message: `Faltam colunas obrigatórias: ${report.missingColumns.join(", ")}.` };
    const base = inspectFile({ fileName: f.name, size: f.size, headers: f.headers, rows: f.rows, spec: LEAD_COLUMNS, labels: LEAD_LABELS, optional: ["Telefone", "E-mail", "Contato", "Código SAP"] });
    const checks = commonChecks(base, { rejected: report.rejected.length, valid: report.valid });
    const cnpjs = drafts.map((d) => d.cnpj);
    let existing = 0, existingProspects = 0;
    for (let k = 0; k < cnpjs.length; k += 2000) {
      const part = cnpjs.slice(k, k + 2000);
      const [r] = await db.execute<{ n: number; p: number }>(sql`select count(*)::int as n, count(*) filter (where kind = 'prospect')::int as p from leads where cnpj in (${sql.join(part.map((c) => sql`${c}`), sql`, `)})`);
      existing += r?.n ?? 0; existingProspects += r?.p ?? 0;
    }
    const fresh = drafts.length - existing;
    if (looksLikeReps) checks.unshift({ level: "bad", text: "Este arquivo parece de REPRESENTANTES (tem COD SAP e NOME REP). Você escolheu importar Leads." });
    if (drafts.length && existing === drafts.length) checks.unshift({ level: "warn", text: "Todos os CNPJs do arquivo já existem no sistema: nada novo vai entrar (os existentes nunca são sobrescritos)." });
    else if (existing > 0) checks.push({ level: "info", text: `${existing.toLocaleString("pt-BR")} CNPJ(s) já existem e serão pulados; ${fresh.toLocaleString("pt-BR")} entram como novos.` });
    if (leadKind === "inativo" && existingProspects > 0) checks.push({ level: "warn", text: `Você escolheu "Inativos", mas ${existingProspects.toLocaleString("pt-BR")} desses CNPJs já são leads novos (do SDR) e continuarão como estão.` });
    if (leadKind === "prospect" && f.headers.some((h) => ["MEIO", "MEIODECONTATO", "QUALIFICADO", "SITUACAO"].includes(headerKey(h)))) checks.push({ level: "info", text: "O arquivo traz colunas de histórico (meio, qualificação ou situação). As tags serão criadas junto com os leads." });
    const phoneCol = base.columns.find((c) => c.field === "Telefone");
    if (phoneCol && drafts.length && drafts.filter((d) => d.phones.length === 0).length / drafts.length > 0.5) checks.push({ level: "warn", text: "Mais da metade dos leads válidos não tem telefone. Eles dependerão da consulta de CNPJ para ter contato." });
    if (!phoneCol) checks.push({ level: "warn", text: "O arquivo não tem coluna de telefone: os leads entram sem contato até a consulta de CNPJ." });
    return { ok: true, kind: "leads", fileName: f.name, report, insight: { ...base, checks }, existing, fresh };
  }
  const { drafts, warnings } = parseRepRows(f.headers, f.rows);
  if (drafts.length === 0) return { ok: false, message: warnings[0] ?? "Nenhum representante encontrado no arquivo." };
  const base = inspectFile({ fileName: f.name, size: f.size, headers: f.headers, rows: f.rows, spec: REP_COLUMNS, labels: REP_LABELS, optional: ["Cidade", "UF", "Gestor", "Equipe"] });
  const checks = commonChecks(base, { rejected: f.rows.length - drafts.length, valid: drafts.length });
  const saps = drafts.map((d) => d.sapCode);
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from reps where sap_code in (${sql.join(saps.map((c) => sql`${c}`), sql`, `)})`);
  const existing = r?.n ?? 0;
  const dupSap = saps.length - new Set(saps).size;
  if (dupSap) checks.push({ level: "warn", text: `${dupSap} código(s) SAP repetido(s) no arquivo: o último de cada um vale.` });
  const noCity = drafts.filter((d) => !d.city || !d.uf).length;
  if (noCity) checks.push({ level: "warn", text: `${noCity} representante(s) sem cidade ou UF: ficam sem coordenadas e não entram na busca do mais próximo.` });
  const badUf = drafts.filter((d) => d.uf && !/^[A-Z]{2}$/.test(d.uf)).length;
  if (badUf) checks.push({ level: "warn", text: `${badUf} UF inválida(s) (use a sigla de 2 letras).` });
  if (looksLikeLeads) checks.unshift({ level: "warn", text: "Este arquivo parece de LEADS (tem CNPJ e EMPRESA, sem NOME REP), mas você escolheu Representantes." });
  checks.push({ level: "info", text: `${existing} representante(s) já existem e serão ATUALIZADOS pelo código SAP; ${drafts.length - existing} entram como novos.` });
  for (const w of warnings.slice(0, 5)) checks.push({ level: "warn", text: w });
  return { ok: true, kind: "reps", fileName: f.name, total: drafts.length, warnings, insight: { ...base, checks }, existing, fresh: drafts.length - existing };
}

/** 2º passo: grava. Leads novos entram; CNPJs que já existem nunca são sobrescritos. */
export async function applyImportAction(formData: FormData): Promise<ImportResult> {
  const me = await requireAdmin();
  const f = await readFile(formData);
  if (f.error !== undefined) return { ok: false, message: f.error };
  const guard = await previewImportAction(formData);
  if (!guard.ok) return { ok: false, message: guard.message };
  const blocker = guard.insight.checks.find((c) => c.level === "bad");
  if (blocker) return { ok: false, message: `Importação bloqueada: ${blocker.text}` };
  if (f.kind === "leads") {
    const { drafts } = parseLeadRows(f.headers, f.rows);
    const kind = formData.get("leadKind") === "inativo" ? "inativo" : "prospect";
    const [batch] = await db.insert(importBatches).values({ kind: kind === "inativo" ? "inativos" : "leads", fileName: f.name, userId: me.id, total: drafts.length }).returning({ id: importBatches.id });
    const r = await applyLeadDrafts(drafts, { importedBy: me.id, sourceName: f.name, kind, batchId: batch.id });
    await db.update(importBatches).set({ inserted: r.inserted, skipped: r.skippedExisting }).where(eq(importBatches.id, batch.id));
    revalidatePath("/leads");
    revalidatePath("/admin/importar");
    return { ok: true, message: `${plural(r.inserted, kind === "inativo" ? "lead inativo importado" : "lead novo importado", kind === "inativo" ? "leads inativos importados" : "leads novos importados")}; ${r.skippedExisting} já ${r.skippedExisting === 1 ? "existia e foi mantido" : "existiam e foram mantidos"}${r.converted ? ` (${r.converted} passaram para inativo)` : ""}.`, details: [...r.unknownOwners.map((o) => `Responsável desconhecido ignorado: ${o}`), ...r.unknownTags.map((t) => `Tag desconhecida ignorada: ${t}`)] };
  }
  const { drafts } = parseRepRows(f.headers, f.rows);
  const r = await applyRepDrafts(drafts, { importedBy: me.id, sourceName: f.name });
  await db.insert(importBatches).values({ kind: "reps", fileName: f.name, userId: me.id, total: drafts.length, inserted: r.total });
  revalidatePath("/representantes");
  return { ok: true, message: `${plural(r.total, "representante importado/atualizado", "representantes importados/atualizados")}.`, details: r.withoutCoords ? [`${r.withoutCoords} sem coordenadas (cidade não encontrada).`] : [] };
}
