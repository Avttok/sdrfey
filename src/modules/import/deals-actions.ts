"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, importBatches, users } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { decodeCsv, parseCsv } from "./csv";
import { applyDealImport, planDealImport, SKIP_LABEL, type Plan, type SkipReason } from "./deals-apply";
import { DEAL_COLUMNS, parseDealRows, type DealImportReport } from "./deals-parse";
import { commonChecks, DEAL_LABELS, inspectFile, type FileInsight } from "./insight";

export type DealImportPreview =
  | { ok: false; message: string }
  | { ok: true; insight: FileInsight; fileName: string; report: DealImportReport; willCreate: number; newLeads: number; existingLeads: number; byStage: Record<string, number>; skipped: { reason: string; count: number; samples: string[] }[]; skippedTotal: number; inPortfolio: Plan["inPortfolio"] };
export type DealImportResult = { ok: boolean; message: string; details?: string[] };

const MAX_BYTES = 8 * 1024 * 1024;

/** Quem será o dono das negociações: o próprio vendedor, ou (gestor/adm) o vendedor escolhido. */
type Me = Awaited<ReturnType<typeof requirePerm>>;
async function resolveSeller(formData: FormData): Promise<{ error: string } | { error?: undefined; me: Me; sellerId: number }> {
  const me = await requirePerm("tab.negociacoes");
  const team = !!me.permissions["deals.team"];
  if (!me.roles.includes("seller") && !team) return { error: "Só vendedores podem importar negociações." };
  let sellerId = me.id;
  const picked = Number(formData.get("sellerId"));
  if (team && Number.isInteger(picked) && picked > 0 && picked !== me.id) {
    const [s] = await db.select({ roles: users.roles, active: users.active }).from(users).where(eq(users.id, picked));
    if (!s?.active || !s.roles.includes("seller")) return { error: "Vendedor inválido." };
    sellerId = picked;
  } else if (!me.roles.includes("seller")) return { error: "Escolha o vendedor dono das negociações." };
  return { me, sellerId };
}

async function load(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo CSV." };
  if (file.size > MAX_BYTES) return { error: "Arquivo grande demais (máximo 8 MB)." };
  try {
    const { headers, rows } = parseCsv(decodeCsv(Buffer.from(await file.arrayBuffer())));
    const r = parseDealRows(headers, rows);
    const base = inspectFile({ fileName: file.name, size: file.size, headers, rows, spec: DEAL_COLUMNS, labels: DEAL_LABELS, optional: ["Etapa", "Condição de pagamento", "Valor da cotação", "Telefone"] });
    if (r.report.missingColumns.length) return { error: `Faltam colunas obrigatórias: ${r.report.missingColumns.join(", ")}.` } as const;
    return { error: undefined, name: file.name, base, ...r } as const;
  } catch {
    return { error: "Não consegui ler o arquivo. Confira se é um CSV." };
  }
}

/** 1º passo: mostra o que entra e o que já existe, sem gravar nada. */
export async function previewDealImportAction(formData: FormData): Promise<DealImportPreview> {
  const s = await resolveSeller(formData);
  if (s.error !== undefined) return { ok: false, message: s.error };
  const f = await load(formData);
  if (typeof f.error === "string") return { ok: false, message: f.error };
  const plan = await planDealImport(f.drafts, s.sellerId);
  const byStage: Record<string, number> = {};
  for (const d of plan.create) byStage[d.stage] = (byStage[d.stage] ?? 0) + 1;
  const groups = new Map<SkipReason, { count: number; samples: string[] }>();
  for (const k of plan.skipped) { const g = groups.get(k.reason) ?? { count: 0, samples: [] }; g.count++; if (g.samples.length < 3) g.samples.push(`linha ${k.line}`); groups.set(k.reason, g); }
  const checks = commonChecks(f.base, { rejected: f.report.rejected.length, valid: f.report.valid });
  if (plan.create.length === 0) checks.unshift({ level: "warn", text: "Nenhuma negociação nova vai ser criada com este arquivo." });
  if (plan.inPortfolio.length) checks.push({ level: "warn", text: `${plan.inPortfolio.length} cliente(s) já estão na carteira de outro vendedor. Você verá o histórico antes de confirmar.` });
  if (plan.skipped.length) checks.push({ level: "info", text: `${plan.skipped.length} linha(s) serão ignoradas para não duplicar negociações existentes.` });
  if (!f.base.columns.some((c) => c.field === "Etapa")) checks.push({ level: "warn", text: "Sem coluna de Etapa: todas as negociações entram na etapa inicial (Novo)." });
  const stageEmpty = f.base.columns.find((c) => c.field === "Etapa" && f.base.totalRows && c.filled / f.base.totalRows < 0.5);
  if (stageEmpty) checks.push({ level: "warn", text: "A coluna Etapa está vazia em mais da metade das linhas: elas entram como Novo." });
  return { ok: true, insight: { ...f.base, checks }, fileName: f.name, report: f.report, willCreate: plan.create.length, newLeads: plan.newLeads, existingLeads: plan.existingLeads, byStage, skippedTotal: plan.skipped.length, inPortfolio: plan.inPortfolio, skipped: [...groups].map(([r, g]) => ({ reason: SKIP_LABEL[r], ...g })) };
}

/** 2º passo: grava só o que é novo. Nada existente é sobrescrito ou duplicado. */
export async function applyDealImportAction(formData: FormData): Promise<DealImportResult> {
  const s = await resolveSeller(formData);
  if (s.error !== undefined) return { ok: false, message: s.error };
  const f = await load(formData);
  if (typeof f.error === "string") return { ok: false, message: f.error };
  const guard = await previewDealImportAction(formData);
  if (!guard.ok) return { ok: false, message: guard.message };
  const blocker = guard.insight.checks.find((c) => c.level === "bad");
  if (blocker) return { ok: false, message: `Importação bloqueada: ${blocker.text}` };
  const plan = await planDealImport(f.drafts, s.sellerId);
  const r = await applyDealImport(plan, { sellerId: s.sellerId, userId: s.me.id, fileName: f.name });
  await db.insert(importBatches).values({ kind: "deals", fileName: f.name, userId: s.me.id, total: plan.create.length + plan.skipped.length, inserted: r.created, skipped: plan.skipped.length });
  for (const p of ["/negociacoes", "/leads", "/painel", "/metas"]) revalidatePath(p);
  const skipped = plan.skipped.length + r.raced;
  return { ok: true, message: `${r.created} ${r.created === 1 ? "negociação importada" : "negociações importadas"}${r.leadsCreated ? ` (${r.leadsCreated} ${r.leadsCreated === 1 ? "lead novo" : "leads novos"})` : ""}; ${skipped} já existiam ou foram ignoradas.`, details: f.report.rejected.slice(0, 5).map((x) => `Linha ${x.line} rejeitada: ${x.reason}`) };
}
