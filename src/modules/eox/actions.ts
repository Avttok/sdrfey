"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leads, settings } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { getCurrentUser, requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { invalidateSettings } from "@/modules/settings/get";
import { eoxFields, eoxLogin } from "./client";
import { EOX_KEY, parseEox } from "./config";
import { ensureEoxId, eoxBaseUrl, eoxProfileUrl, eoxRecordForCall, eoxStep, loadEox, syncEoxLinks, type EoxStep } from "./sync";

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

/** Ao iniciar uma ligação: o link do cadastro na EOX, pelo lead ou pelo telefone discado. Procura na EOX se ainda não estiver ligado. */
export async function resolveEoxLinkAction(digits: string, leadId: number | null): Promise<string | null> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return null;
  const { record } = await eoxRecordForCall(me.id, String(digits ?? ""), leadId);
  return eoxProfileUrl(await eoxBaseUrl(), record);
}

export type EoxCoverage = { total: number; withCode: number; withId: number; withInfo: number; blocked: number; customers: number; lastSyncAt: string | null };
/** Quantos leads já têm cada número da EOX e o retrato do cadastro (para o painel da integração). */
export async function eoxCoverage(): Promise<EoxCoverage> {
  const [r] = await db.execute<{ total: number; with_code: number; with_id: number; with_info: number; blocked: number; customers: number; last_sync: string | null }>(sql`
    select count(*)::int as total, count(*) filter (where eox_id ~ '^\\d{7,}$' and eox_id is distinct from eox_code)::int as with_code, count(*) filter (where eox_code is not null)::int as with_id,
      count(*) filter (where eox_info is not null)::int as with_info, count(*) filter (where eox_info->>'Discagens bloqueadas' ilike 'sim')::int as blocked,
      count(*) filter (where eox_info->>'Tipo' = 'Customer')::int as customers, max(eox_synced_at) as last_sync
    from leads where is_test = false`);
  return { total: Number(r.total), withCode: Number(r.with_code), withId: Number(r.with_id), withInfo: Number(r.with_info), blocked: Number(r.blocked), customers: Number(r.customers), lastSyncAt: r.last_sync ? new Date(r.last_sync).toISOString() : null };
}

/** Um passo da varredura da base inteira (a tela chama em loop até acabar ou o usuário pausar). */
export async function eoxStepAction(phase: "direct" | "scan", restart = false): Promise<EoxStep> {
  const me = await requireAdmin();
  const r = await eoxStep(phase === "scan" ? "scan" : "direct", { userId: me.id, restart, budgetMs: 25_000 });
  if (r.linked) await logAudit(db, { userId: me.id, entity: "setting", action: "varredura da EOX", field: phase, newValue: `${r.linked} cadastros ligados em ${r.checked} verificados` });
  return r;
}
