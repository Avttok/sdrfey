"use server";

import { count, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leads, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { getCurrentUser, requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";
import { eoxFields, eoxLogin } from "./client";
import { EOX_KEY, parseEox } from "./config";
import { ensureEoxId, eoxBaseUrl, eoxProfileUrl, loadEox, syncEoxLinks } from "./sync";

const fail = (message: string): ActionResult => ({ ok: false, message });

/** Salva a integração. Chave de acesso em branco = mantém a que já estava. Só o Adm. */
export async function saveEoxConfigAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const old = await loadEox();
  const c = parseEox(input);
  if (!c.accessKey) c.accessKey = old.accessKey;
  if (c.on && (!c.baseUrl || !c.username || !c.accessKey || !c.cnpjField)) return fail("Preencha endereço, usuário, chave de acesso e o campo do CNPJ para ligar.");
  await db.insert(settings).values({ key: EOX_KEY, value: c, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: c, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou integração EOX", field: EOX_KEY, newValue: c.on ? `ligada (${c.baseUrl}, usuário ${c.username})` : "desligada" });
  revalidatePath("/admin/eox");
  return { ok: true, message: "Integração salva." };
}

/** Testa o login e devolve os campos do módulo (para achar o do CNPJ). */
export async function testEoxAction(): Promise<ActionResult & { fields?: { name: string; label: string }[] }> {
  await requireAdmin();
  const c = await loadEox();
  if (!c.baseUrl || !c.username || !c.accessKey) return fail("Salve endereço, usuário e chave de acesso primeiro.");
  try {
    const s = await eoxLogin(c);
    const fields = await eoxFields(s);
    return { ok: true, message: `Conectou na EOX. O módulo ${c.module} tem ${fields.length} campos.`, fields };
  } catch (e) { return fail(`Não conectou: ${(e as Error).message}`); }
}

/** Sincroniza agora (a tarefa diária faz o mesmo sozinha). */
export async function syncEoxNowAction(): Promise<ActionResult> {
  const me = await requireAdmin();
  const r = await syncEoxLinks({ userId: me.id, budgetMs: 40_000 });
  revalidatePath("/admin/eox");
  return { ok: r.ok, message: r.message };
}

/** Usada pelo botão Ligar: lead sem link da EOX → procura pelo CNPJ e grava. */
export async function ensureEoxLinkAction(leadId: number): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !Number.isInteger(leadId)) return null;
  return eoxProfileUrl(await eoxBaseUrl(), await ensureEoxId(leadId, me.id));
}

export async function eoxCoverage(): Promise<{ total: number; without: number }> {
  const [[t], [w]] = await Promise.all([db.select({ n: count() }).from(leads), db.select({ n: count() }).from(leads).where(isNull(leads.eoxUrl))]);
  return { total: t.n, without: w.n };
}
