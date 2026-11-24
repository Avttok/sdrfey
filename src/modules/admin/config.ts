"use server";

import { invalidateSettings } from "@/modules/settings/get";
import { plural } from "@/lib/format";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSION_KEYS, type PermissionMap } from "@/config/permissions";
import type { Role } from "@/config/roles";
import { sanitizeHtml } from "@/modules/email/render";
import { db, emailTemplates, leadTags, leads, settings, tags, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { SETTING_DEFAULTS, getSettings, type SettingKey } from "@/modules/settings/get";

const fail = (message: string): ActionResult => ({ ok: false, message });
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/* ───── Parâmetros globais ───── */
const PARAM_KEYS = ["lock_minutes", "skip_hours", "sem_contato_days", "rework_days", "alert_days", "dash_default_days", "nav_group", "chat_on", "seller_queue_on", "deal_new_untouched_hours", "deal_pool_hours", "deal_quote_chase_days", "deal_stale_days", "deal_followup_days", "enrich_retry_hours", "import_max_mb", "import_max_rows", "pdf_max_mb", "email_img_px", "email_img_kb", "email_html_kb", "copy_guard", "logo_anim", "logo_pace", "logo_text", "enrich_fast", "enrich_receitaws", "enrich_brasilapi", "enrich_minhareceita", "enrich_places", "enrich_site", "update_notice"] as const;
/** As metas ficam na aba Metas; aqui só as regras do sorteio. */
export async function saveSettingsAction(values: Record<(typeof PARAM_KEYS)[number], number>): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({
    lock_minutes: z.number().int().min(1).max(600),
    skip_hours: z.number().int().min(0).max(720), sem_contato_days: z.number().int().min(0).max(365), rework_days: z.number().int().min(0).max(3650),
    alert_days: z.number().int().min(1).max(60), dash_default_days: z.union([z.literal(1), z.literal(7), z.literal(30)]), nav_group: z.union([z.literal(0), z.literal(1)]), chat_on: z.union([z.literal(0), z.literal(1)]), seller_queue_on: z.union([z.literal(0), z.literal(1)]),
    deal_new_untouched_hours: z.number().int().min(1).max(720), deal_pool_hours: z.number().int().min(1).max(720), deal_quote_chase_days: z.number().int().min(1).max(60), deal_stale_days: z.number().int().min(1).max(90), deal_followup_days: z.number().int().min(1).max(30),
    enrich_retry_hours: z.number().int().min(1).max(720), import_max_mb: z.number().int().min(1).max(50), import_max_rows: z.number().int().min(100).max(200000), pdf_max_mb: z.number().int().min(1).max(30), email_img_px: z.number().int().min(200).max(4000), email_img_kb: z.number().int().min(50).max(5000), email_html_kb: z.number().int().min(100).max(9000), copy_guard: z.union([z.literal(0), z.literal(1)]), logo_anim: z.union([z.literal(0), z.literal(1), z.literal(2)]), logo_pace: z.union([z.literal(0), z.literal(1), z.literal(2)]), logo_text: z.union([z.literal(0), z.literal(1)]),
    enrich_fast: z.union([z.literal(0), z.literal(1)]), enrich_receitaws: z.union([z.literal(0), z.literal(1)]), enrich_brasilapi: z.union([z.literal(0), z.literal(1)]), enrich_minhareceita: z.union([z.literal(0), z.literal(1)]), enrich_places: z.union([z.literal(0), z.literal(1)]), enrich_site: z.union([z.literal(0), z.literal(1)]), update_notice: z.union([z.literal(0), z.literal(1)]),
  }).safeParse(values);
  if (!p.success) return fail("Confira os valores: precisam ser números inteiros dentro de limites razoáveis.");
  const before = await getSettings();
  for (const k of PARAM_KEYS) {
    if (before[k] === p.data[k]) continue;
    await db.insert(settings).values({ key: k, value: p.data[k], updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: p.data[k], updatedAt: new Date(), updatedBy: me.id } });
    invalidateSettings();
    await logAudit(db, { userId: me.id, entity: "setting", action: "alterou parâmetro", field: k, oldValue: before[k], newValue: p.data[k] });
  }
  revalidatePath("/admin/parametros");
  revalidatePath("/", "layout");
  return { ok: true, message: "Parâmetros salvos." };
}

/* ───── Permissões padrão de um cargo ───── */
export async function saveRolePermissionsAction(role: Exclude<Role, "admin">, map: PermissionMap): Promise<ActionResult> {
  const me = await requireAdmin();
  const clean = Object.fromEntries(Object.entries(map).filter(([k]) => PERMISSION_KEYS.includes(k)));
  const [row] = await db.select().from(settings).where(eq(settings.key, "role_permissions"));
  const all = { ...((row?.value ?? {}) as Record<string, PermissionMap>), [role]: clean };
  await db.insert(settings).values({ key: "role_permissions", value: all, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: all, updatedAt: new Date(), updatedBy: me.id } });
  invalidateSettings();
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou permissões do cargo", field: role, oldValue: JSON.stringify((row?.value as Record<string, unknown> | undefined)?.[role] ?? {}), newValue: JSON.stringify(clean) });
  revalidatePath("/admin/permissoes");
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Permissões do cargo salvas." };
}

/* ───── Tags ───── */
const tagInput = z.object({ id: z.number().int().optional(), groupKey: z.string().min(1), label: z.string().trim().min(1, "Informe o nome da tag.").max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."), blocksSorting: z.boolean(), cooldownDays: z.number().int().min(0).max(3650).nullable(), active: z.boolean(), icon: z.string().max(30).nullable().optional() });

export async function saveTagAction(input: z.input<typeof tagInput>): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = tagInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.id) {
    const [b] = await db.select().from(tags).where(eq(tags.id, d.id));
    if (!b) return fail("Tag não encontrada.");
    await db.update(tags).set({ label: d.label, color: d.color, blocksSorting: d.blocksSorting, cooldownDays: d.cooldownDays, active: d.active, icon: d.icon ?? null }).where(eq(tags.id, d.id));
    for (const [f, o, n] of [["Nome", b.label, d.label], ["Cor", b.color, d.color], ["Tira do sorteio", b.blocksSorting, d.blocksSorting], ["Volta ao sorteio (dias)", b.cooldownDays, d.cooldownDays], ["Ativa", b.active, d.active]] as const) {
      if (String(o) !== String(n)) await logAudit(db, { userId: me.id, entity: "tag", action: "alterou tag", field: `${b.label} · ${f}`, oldValue: o as never, newValue: n as never });
    }
  } else {
    const key = slug(d.label);
    if (!key) return fail("Nome inválido.");
    const [dup] = await db.select({ id: tags.id }).from(tags).where(sql`${tags.groupKey} = ${d.groupKey} and ${tags.key} = ${key}`);
    if (dup) return fail("Já existe uma tag com esse nome neste grupo.");
    await db.insert(tags).values({ groupKey: d.groupKey, key, label: d.label, color: d.color, blocksSorting: d.blocksSorting, cooldownDays: d.cooldownDays, active: d.active, icon: d.icon ?? null });
    await logAudit(db, { userId: me.id, entity: "tag", action: "criou tag", field: d.groupKey, newValue: d.label });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Tag salva." };
}

/** Apaga a tag; se algum lead a usa, apenas desativa (os leads mantêm o histórico). */
export async function deleteTagAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [t] = await db.select().from(tags).where(eq(tags.id, id));
  if (!t) return fail("Tag não encontrada.");
  const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(leadTags).where(eq(leadTags.tagId, id));
  if ((u?.n ?? 0) > 0) {
    await db.update(tags).set({ active: false }).where(eq(tags.id, id));
    await logAudit(db, { userId: me.id, entity: "tag", action: "desativou tag", field: t.label, oldValue: "ativa", newValue: "inativa", meta: { leads: u.n } });
    revalidatePath("/", "layout");
    return { ok: true, message: `A tag está em ${plural(u.n, "lead", "leads")}, então foi desativada em vez de apagada.` };
  }
  await db.delete(tags).where(eq(tags.id, id));
  await logAudit(db, { userId: me.id, entity: "tag", action: "excluiu tag", field: t.label });
  revalidatePath("/", "layout");
  return { ok: true, message: "Tag excluída." };
}

/* ───── Modelos de e-mail ───── */
export async function saveTemplateAction(input: { id?: number; name: string; subject: string; body: string; bodyHtml?: string | null; active: boolean }): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({ id: z.number().int().optional(), name: z.string().trim().min(1, "Informe o nome do modelo."), subject: z.string().trim().min(1, "Informe o assunto."), body: z.string().trim().min(1, "Escreva o texto."), bodyHtml: z.string().max(12_000_000, "O modelo ficou grande demais (imagens pesadas). Use uma imagem menor.").nullish(), active: z.boolean() }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, bodyHtml, ...rest } = p.data;
  if (bodyHtml && bodyHtml.length > (await getSettings()).email_html_kb * 1024) return fail("O modelo ficou grande demais (imagens pesadas). Use uma imagem menor ou aumente o limite em Parâmetros.");
  const v = { ...rest, bodyHtml: bodyHtml ? sanitizeHtml(bodyHtml) : null };
  if (id) {
    const [b] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    await db.update(emailTemplates).set(v).where(eq(emailTemplates.id, id));
    for (const k of ["name", "subject", "body", "bodyHtml", "active"] as const) if (b && String(b[k] ?? "") !== String(v[k] ?? "")) await logAudit(db, { userId: me.id, entity: "template", action: "alterou modelo", field: `${b.name} · ${k}`, oldValue: b[k], newValue: v[k] });
  } else {
    await db.insert(emailTemplates).values(v);
    await logAudit(db, { userId: me.id, entity: "template", action: "criou modelo", field: v.name });
  }
  revalidatePath("/admin/modelos");
  return { ok: true, message: "Modelo salvo." };
}
export async function deleteTemplateAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [b] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  if (!b) return fail("Modelo não encontrado.");
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  await logAudit(db, { userId: me.id, entity: "template", action: "excluiu modelo", field: b.name });
  revalidatePath("/admin/modelos");
  return { ok: true, message: "Modelo excluído." };
}

/* ───── Modo teste: leads falsos que nunca entram nas métricas reais ───── */
export async function createTestLeadsAction(n: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const count = Math.min(Math.max(Math.trunc(n) || 0, 1), 200);
  const base = Date.now() % 1_000_000;
  await db.insert(leads).values(Array.from({ length: count }, (_, i) => ({ cnpj: `99${String(base).padStart(6, "0")}${String(i).padStart(6, "0")}`, company: `LEAD DE TESTE ${i + 1}`, isTest: true, city: "Cuiabá", uf: "MT", source: "modo teste" })));
  await logAudit(db, { userId: me.id, entity: "setting", action: "criou leads de teste", field: "Modo teste", newValue: count });
  revalidatePath("/admin/modo-teste");
  return { ok: true, message: `${count} leads de teste criados. Eles só aparecem para quem atende em modo teste.` };
}
export async function clearTestDataAction(): Promise<ActionResult> {
  const me = await requireAdmin();
  const del = await db.delete(leads).where(eq(leads.isTest, true)).returning({ id: leads.id });
  await logAudit(db, { userId: me.id, entity: "setting", action: "apagou leads de teste", field: "Modo teste", oldValue: del.length, newValue: 0 });
  revalidatePath("/admin/modo-teste");
  return { ok: true, message: `${del.length} leads de teste apagados (com atendimentos e contatos).` };
}

/** Salva a nova ordem das tags de um grupo (a ordem que todos veem). Recebe os ids na ordem final. */
export async function reorderTagsAction(groupKey: string, orderedIds: number[]): Promise<ActionResult> {
  const me = await requireAdmin();
  const list = await db.select().from(tags).where(eq(tags.groupKey, groupKey)).orderBy(asc(tags.sort), asc(tags.label));
  const known = new Set(list.map((t) => t.id));
  if (orderedIds.length !== list.length || !orderedIds.every((id) => known.has(id))) return fail("A lista mudou. Recarregue a página e tente de novo.");
  const before = list.map((t) => t.label).join(" › ");
  const byId = new Map(list.map((t) => [t.id, t]));
  await db.transaction(async (tx) => {
    for (const [pos, id] of orderedIds.entries()) if (byId.get(id)!.sort !== pos) await tx.update(tags).set({ sort: pos }).where(eq(tags.id, id));
    await logAudit(tx, { userId: me.id, entity: "tag", action: "reordenou tags", field: groupKey, oldValue: before, newValue: orderedIds.map((id) => byId.get(id)!.label).join(" › ") });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Ordem das tags salva." };
}

/** Grade de permissões: padrão de cada cargo + ajuste de cada pessoa (liberar/bloquear), tudo de uma vez. */
export async function savePermissionMatrixAction(input: { roles: Record<"user" | "seller" | "manager", PermissionMap>; users: Record<number, PermissionMap> }): Promise<ActionResult> {
  const me = await requireAdmin();
  const clean = (m: PermissionMap) => Object.fromEntries(Object.entries(m ?? {}).filter(([k, v]) => PERMISSION_KEYS.includes(k) && typeof v === "boolean"));
  const [row] = await db.select().from(settings).where(eq(settings.key, "role_permissions"));
  const before = (row?.value ?? {}) as Record<string, PermissionMap>;
  const next = { ...before, user: clean(input.roles.user), seller: clean(input.roles.seller), manager: clean(input.roles.manager) };
  let changed = 0;
  await db.transaction(async (tx) => {
    for (const role of ["user", "seller", "manager"] as const) {
      if (JSON.stringify(before[role] ?? {}) === JSON.stringify(next[role])) continue;
      changed++;
      await logAudit(tx, { userId: me.id, entity: "setting", action: "alterou permissões do cargo", field: role, oldValue: JSON.stringify(before[role] ?? {}), newValue: JSON.stringify(next[role]) });
    }
    await tx.insert(settings).values({ key: "role_permissions", value: next, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date(), updatedBy: me.id } });
    invalidateSettings();
    for (const [idStr, map] of Object.entries(input.users)) {
      const id = Number(idStr);
      const [u] = await tx.select({ name: users.name, permissions: users.permissions }).from(users).where(eq(users.id, id));
      if (!u) continue;
      const perms = clean(map);
      if (JSON.stringify(u.permissions ?? {}) === JSON.stringify(perms)) continue;
      changed++;
      await tx.update(users).set({ permissions: perms }).where(eq(users.id, id));
      await logAudit(tx, { userId: me.id, entity: "user", action: "alterou", field: `${u.name} · Permissões individuais`, oldValue: JSON.stringify(u.permissions ?? {}), newValue: JSON.stringify(perms) });
    }
  });
  revalidatePath("/", "layout");
  return { ok: true, message: changed ? "Permissões salvas." : "Nada mudou." };
}

/* ───── Posição das abas na barra superior ───── */
export async function saveNavAlignAction(value: number): Promise<ActionResult> {
  const me = await requireAdmin();
  if (value !== 0 && value !== 1 && value !== 2) return fail("Posição inválida.");
  const before = (await getSettings()).nav_align;
  if (before !== value) {
    await db.insert(settings).values({ key: "nav_align", value, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date(), updatedBy: me.id } });
    invalidateSettings();
    await logAudit(db, { userId: me.id, entity: "setting", action: "alterou parâmetro", field: "nav_align", oldValue: before, newValue: value });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Posição das abas salva." };
}
