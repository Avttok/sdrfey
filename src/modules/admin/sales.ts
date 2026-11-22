"use server";

import { invalidateSettings } from "@/modules/settings/get";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, paymentTerms, products, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { parseMoneyToCents } from "@/config/deals";
import { getExtraTaxPct, getIcmsRule, normTerm } from "@/modules/quotes/db";
import { cleanIcmsRule } from "@/modules/quotes/icms";

const done = (message: string): ActionResult => { revalidatePath("/admin/vendas"); revalidatePath("/negociacoes"); return { ok: true, message }; };
const bad = (message: string): ActionResult => ({ ok: false, message });

/** Condições de pagamento: criar (id null) ou editar/ativar/desativar. */
export async function savePaymentTermAction(id: number | null, name: string, active: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  const n = normTerm(name);
  if (!n) return bad("Digite o nome da condição.");
  try {
    if (id) {
      const [old] = await db.select().from(paymentTerms).where(eq(paymentTerms.id, id));
      if (!old) return bad("Condição não encontrada.");
      await db.update(paymentTerms).set({ name: n, active }).where(eq(paymentTerms.id, id));
      await logAudit(db, { userId: me.id, entity: "setting", action: "editou condição de pagamento", field: "Condição de pagamento", oldValue: `${old.name}${old.active ? "" : " (inativa)"}`, newValue: `${n}${active ? "" : " (inativa)"}` });
    } else {
      await db.insert(paymentTerms).values({ name: n, active });
      await logAudit(db, { userId: me.id, entity: "setting", action: "criou condição de pagamento", field: "Condição de pagamento", newValue: n });
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return bad("Essa condição já existe.");
    throw e;
  }
  return done("Condição salva.");
}

export async function deletePaymentTermAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [old] = await db.select().from(paymentTerms).where(eq(paymentTerms.id, id));
  if (!old) return bad("Condição não encontrada.");
  await db.delete(paymentTerms).where(eq(paymentTerms.id, id));
  await logAudit(db, { userId: me.id, entity: "setting", action: "removeu condição de pagamento", field: "Condição de pagamento", oldValue: old.name });
  return done("Condição removida. Cotações antigas mantêm o texto.");
}

/** Catálogo de produtos: criar (id null) ou editar. */
export async function saveProductAction(id: number | null, input: { code: string; description: string; kind: string; unit: string; price?: string; weight?: string; altCodes?: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const code = input.code.trim().slice(0, 40);
  const description = input.description.trim().slice(0, 300);
  if (!code || !description) return bad("Código e descrição são obrigatórios.");
  /* preço e peso não aparecem mais no admin, mas continuam guardados: só mudam se vierem preenchidos */
  const priceRaw = (input.price ?? "").trim();
  const price = priceRaw ? parseMoneyToCents(priceRaw) : undefined;
  if (price === null) return bad("Preço inválido.");
  const wRaw = (input.weight ?? "").trim();
  const weightKg = wRaw ? Number(wRaw.replace(/\./g, "").replace(",", ".")) : undefined;
  if (wRaw && (weightKg === undefined || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100000)) return bad("Peso inválido. Exemplo: 0,015.");
  const altCodes = [...new Set((input.altCodes ?? "").split(/[\n,;]+/).map((x) => x.trim().slice(0, 40)).filter((x) => x && x !== code))].slice(0, 50);
  const v = { code, description, kind: input.kind.trim().slice(0, 40) || null, unit: input.unit.trim().slice(0, 8) || null, altCodes, ...(price !== undefined ? { lastUnitCents: price } : {}), ...(weightKg !== undefined ? { weightKg } : {}) };
  try {
    if (id) {
      const [old] = await db.select().from(products).where(eq(products.id, id));
      if (!old) return bad("Produto não encontrado.");
      await db.update(products).set({ ...v, updatedAt: new Date() }).where(eq(products.id, id));
      await logAudit(db, { userId: me.id, entity: "setting", action: "editou produto", field: `Produto ${old.code}`, oldValue: old.description, newValue: description });
    } else {
      await db.insert(products).values(v);
      await logAudit(db, { userId: me.id, entity: "setting", action: "criou produto", field: `Produto ${code}`, newValue: description });
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return bad("Já existe um produto com esse código.");
    throw e;
  }
  return done("Produto salvo.");
}

export async function deleteProductAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [old] = await db.select().from(products).where(eq(products.id, id));
  if (!old) return bad("Produto não encontrado.");
  await db.delete(products).where(eq(products.id, id));
  await logAudit(db, { userId: me.id, entity: "setting", action: "removeu produto", field: `Produto ${old.code}`, oldValue: old.description });
  return done("Produto removido do catálogo.");
}

/** Imposto extra (PIS/COFINS, %) descontado do valor sem impostos das cotações novas. */
export async function saveExtraTaxAction(pct: number): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return bad("Informe um percentual entre 0 e 99,99.");
  const old = await getExtraTaxPct();
  await db.insert(settings).values({ key: "net_extra_tax_pct", value: pct, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: pct, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou imposto extra do valor sem impostos", field: "PIS/COFINS (%)", oldValue: String(old), newValue: String(pct) });
  return done("Percentual salvo. Vale para cotações novas ou editadas.");
}

/** Regra de ICMS das cotações: modo (valor do PDF ou percentual), padrão e percentual por UF. */
export async function saveIcmsRuleAction(raw: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const rule = cleanIcmsRule(raw);
  const old = await getIcmsRule();
  await db.insert(settings).values({ key: "icms_rule", value: rule, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: rule, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou regra de ICMS", field: "icms_rule", oldValue: JSON.stringify(old), newValue: JSON.stringify(rule) });
  return done(rule.mode === "rate" ? "Regra salva: o ICMS passa a vir dos percentuais abaixo nas cotações novas ou editadas." : "Regra salva: o ICMS continua vindo do PDF/itens (os percentuais só valem se você digitar na cotação).");
}
