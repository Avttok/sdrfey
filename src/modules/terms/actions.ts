"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cleanOverrides, TERMS_KEY } from "@/config/terms";
import { db, settings, termSwaps } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";
import { commitSwap, MAX_ROWS, previewSwap, revertSwap, type SwapOpts, type SwapPreview } from "./swap";

const fail = (message: string): ActionResult => ({ ok: false, message });

/** Salva os apelidos do Glossário (só o que difere do nome padrão). */
export async function saveTermsAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const value = cleanOverrides(input);
  await db.insert(settings).values({ key: TERMS_KEY, value, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou o Glossário", field: TERMS_KEY, newValue: Object.keys(value).length ? Object.entries(value).map(([k, v]) => `${k} → ${v}`).join("; ") : "nomes padrão" });
  revalidatePath("/", "layout");
  return { ok: true, message: Object.keys(value).length ? "Glossário salvo. Os nomes já valem para todos." : "Todos os nomes voltaram ao padrão." };
}

const swapIn = z.object({ from: z.string().trim().min(2, "Digite o termo atual (2 letras ou mais).").max(80), to: z.string().trim().min(1, "Digite o termo novo.").max(80), matchCase: z.boolean(), wholeWord: z.boolean() });
function parseSwap(input: unknown): { ok: true; v: SwapOpts } | { ok: false; message: string } {
  const p = swapIn.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (p.data.from === p.data.to) return { ok: false, message: "O termo novo é igual ao atual." };
  if (/[<>]/.test(p.data.to)) return { ok: false, message: "Não use < ou > no termo novo." };
  return { ok: true, v: p.data };
}

/** Prévia: onde o termo aparece e como ficaria. Não muda nada. */
export async function previewSwapAction(input: unknown): Promise<{ ok: boolean; message?: string; preview?: SwapPreview }> {
  await requireAdmin();
  const p = parseSwap(input);
  if (!p.ok) return p;
  const { preview } = await previewSwap(p.v);
  return { ok: true, preview };
}

/** Aplica a troca (recalcula na hora, em uma transação) e guarda o antes/depois para desfazer. */
export async function applySwapAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = parseSwap(input);
  if (!p.ok) return fail(p.message);
  const { preview, changes } = await previewSwap(p.v);
  if (!changes.length) return fail("Não encontrei esse termo em nenhum lugar.");
  if (changes.length > MAX_ROWS) return fail(`São ${changes.length} linhas: acima do limite de ${MAX_ROWS} por troca. Use um termo mais específico.`);
  await commitSwap(me.id, p.v, changes, preview);
  for (const path of ["/admin/tags", "/admin/modelos", "/admin/roteiros", "/admin/avisos", "/admin/glossario", "/scripts", "/email"]) revalidatePath(path);
  revalidatePath("/", "layout");
  return { ok: true, message: `Troquei ${preview.total} ocorrência${preview.total === 1 ? "" : "s"} em ${changes.length} linha${changes.length === 1 ? "" : "s"}.` };
}

/** Desfaz uma troca (só as linhas que ninguém editou depois). */
export async function undoSwapAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [s] = await db.select().from(termSwaps).where(eq(termSwaps.id, id));
  if (!s) return fail("Troca não encontrada.");
  if (s.undoneAt) return fail("Essa troca já foi desfeita.");
  const r = await revertSwap(me.id, s);
  revalidatePath("/admin/glossario"); revalidatePath("/", "layout");
  return { ok: true, message: `Desfeito: ${r.restored} linha${r.restored === 1 ? "" : "s"} voltaram${r.skipped ? ` (${r.skipped} foram editadas depois e ficaram como estão)` : ""}.` };
}

