"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, users } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { decodeCsv, parseCsv } from "./csv";
import { applyDealImport, planDealImport, SKIP_LABEL, type Plan, type SkipReason } from "./deals-apply";
import { parseDealRows, type DealImportReport } from "./deals-parse";

export type DealImportPreview =
  | { ok: false; message: string }
  | { ok: true; fileName: string; report: DealImportReport; willCreate: number; newLeads: number; existingLeads: number; byStage: Record<string, number>; skipped: { reason: string; count: number; samples: string[] }[]; skippedTotal: number; inPortfolio: Plan["inPortfolio"] };
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
    if (r.report.missingColumns.length) return { error: `Faltam colunas obrigatórias: ${r.report.missingColumns.join(", ")}.` } as const;
    return { error: undefined, name: file.name, ...r } as const;
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
  return { ok: true, fileName: f.name, report: f.report, willCreate: plan.create.length, newLeads: plan.newLeads, existingLeads: plan.existingLeads, byStage, skippedTotal: plan.skipped.length, inPortfolio: plan.inPortfolio, skipped: [...groups].map(([r, g]) => ({ reason: SKIP_LABEL[r], ...g })) };
}

/** 2º passo: grava só o que é novo. Nada existente é sobrescrito ou duplicado. */
export async function applyDealImportAction(formData: FormData): Promise<DealImportResult> {
  const s = await resolveSeller(formData);
  if (s.error !== undefined) return { ok: false, message: s.error };
  const f = await load(formData);
  if (typeof f.error === "string") return { ok: false, message: f.error };
  const plan = await planDealImport(f.drafts, s.sellerId);
  const r = await applyDealImport(plan, { sellerId: s.sellerId, userId: s.me.id, fileName: f.name });
  for (const p of ["/negociacoes", "/leads", "/painel", "/metas"]) revalidatePath(p);
  const skipped = plan.skipped.length + r.raced;
  return { ok: true, message: `${r.created} ${r.created === 1 ? "negociação importada" : "negociações importadas"}${r.leadsCreated ? ` (${r.leadsCreated} ${r.leadsCreated === 1 ? "lead novo" : "leads novos"})` : ""}; ${skipped} já existiam ou foram ignoradas.`, details: f.report.rejected.slice(0, 5).map((x) => `Linha ${x.line} rejeitada: ${x.reason}`) };
}
