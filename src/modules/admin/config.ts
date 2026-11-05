"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSION_KEYS, type PermissionMap } from "@/config/permissions";
import type { Role } from "@/config/roles";
import { db, emailTemplates, leadTags, leads, settings, tags } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { SETTING_DEFAULTS, getSettings, type SettingKey } from "@/modules/settings/get";

const fail = (message: string): ActionResult => ({ ok: false, message });
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/* ───── Parâmetros globais ───── */
export async function saveSettingsAction(values: Record<SettingKey, number>): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({
    lock_minutes: z.number().int().min(1).max(600), daily_goal: z.number().int().min(0).max(1000),
    skip_hours: z.number().int().min(0).max(720), sem_contato_days: z.number().int().min(0).max(365), rework_days: z.number().int().min(0).max(3650),
  }).safeParse(values);
  if (!p.success) return fail("Confira os valores: precisam ser números inteiros dentro de limites razoáveis.");
  const before = await getSettings();
  for (const k of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    if (before[k] === p.data[k]) continue;
    await db.insert(settings).values({ key: k, value: p.data[k], updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: p.data[k], updatedAt: new Date(), updatedBy: me.id } });
    await logAudit(db, { userId: me.id, entity: "setting", action: "alterou parâmetro", field: k, oldValue: before[k], newValue: p.data[k] });
  }
  revalidatePath("/admin/parametros");
  return { ok: true, message: "Parâmetros salvos." };
}

/* ───── Permissões padrão de um cargo ───── */
export async function saveRolePermissionsAction(role: Exclude<Role, "admin">, map: PermissionMap): Promise<ActionResult> {
  const me = await requireAdmin();
  const clean = Object.fromEntries(Object.entries(map).filter(([k]) => PERMISSION_KEYS.includes(k)));
  const [row] = await db.select().from(settings).where(eq(settings.key, "role_permissions"));
  const all = { ...((row?.value ?? {}) as Record<string, PermissionMap>), [role]: clean };
  await db.insert(settings).values({ key: "role_permissions", value: all, updatedBy: me.id }).onConflictDoUpdate({ target: settings.key, set: { value: all, updatedAt: new Date(), updatedBy: me.id } });
  await logAudit(db, { userId: me.id, entity: "setting", action: "alterou permissões do cargo", field: role, oldValue: JSON.stringify((row?.value as Record<string, unknown> | undefined)?.[role] ?? {}), newValue: JSON.stringify(clean) });
  revalidatePath("/admin/permissoes");
  return { ok: true, message: "Permissões do cargo salvas." };
}

/* ───── Tags ───── */
const tagInput = z.object({ id: z.number().int().optional(), groupKey: z.string().min(1), label: z.string().trim().min(1, "Informe o nome da tag.").max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."), blocksSorting: z.boolean(), cooldownDays: z.number().int().min(0).max(3650).nullable(), active: z.boolean() });

export async function saveTagAction(input: z.input<typeof tagInput>): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = tagInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const d = p.data;
  if (d.id) {
    const [b] = await db.select().from(tags).where(eq(tags.id, d.id));
    if (!b) return fail("Tag não encontrada.");
    await db.update(tags).set({ label: d.label, color: d.color, blocksSorting: d.blocksSorting, cooldownDays: d.cooldownDays, active: d.active }).where(eq(tags.id, d.id));
    for (const [f, o, n] of [["Nome", b.label, d.label], ["Cor", b.color, d.color], ["Tira do sorteio", b.blocksSorting, d.blocksSorting], ["Volta ao sorteio (dias)", b.cooldownDays, d.cooldownDays], ["Ativa", b.active, d.active]] as const) {
      if (String(o) !== String(n)) await logAudit(db, { userId: me.id, entity: "tag", action: "alterou tag", field: `${b.label} · ${f}`, oldValue: o as never, newValue: n as never });
    }
  } else {
    const key = slug(d.label);
    if (!key) return fail("Nome inválido.");
    const [dup] = await db.select({ id: tags.id }).from(tags).where(sql`${tags.groupKey} = ${d.groupKey} and ${tags.key} = ${key}`);
    if (dup) return fail("Já existe uma tag com esse nome neste grupo.");
    await db.insert(tags).values({ groupKey: d.groupKey, key, label: d.label, color: d.color, blocksSorting: d.blocksSorting, cooldownDays: d.cooldownDays, active: d.active });
    await logAudit(db, { userId: me.id, entity: "tag", action: "criou tag", field: d.groupKey, newValue: d.label });
  }
  revalidatePath("/admin/tags");
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
    revalidatePath("/admin/tags");
    return { ok: true, message: `A tag está em ${u.n} lead(s), então foi desativada em vez de apagada.` };
  }
  await db.delete(tags).where(eq(tags.id, id));
  await logAudit(db, { userId: me.id, entity: "tag", action: "excluiu tag", field: t.label });
  revalidatePath("/admin/tags");
  return { ok: true, message: "Tag excluída." };
}

/* ───── Modelos de e-mail ───── */
export async function saveTemplateAction(input: { id?: number; name: string; subject: string; body: string; active: boolean }): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = z.object({ id: z.number().int().optional(), name: z.string().trim().min(1, "Informe o nome do modelo."), subject: z.string().trim().min(1, "Informe o assunto."), body: z.string().trim().min(1, "Escreva o texto."), active: z.boolean() }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, ...v } = p.data;
  if (id) {
    const [b] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    await db.update(emailTemplates).set(v).where(eq(emailTemplates.id, id));
    for (const k of ["name", "subject", "body", "active"] as const) if (b && String(b[k]) !== String(v[k])) await logAudit(db, { userId: me.id, entity: "template", action: "alterou modelo", field: `${b.name} · ${k}`, oldValue: b[k], newValue: v[k] });
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

/** Move uma tag para cima/baixo dentro do próprio grupo (muda a ordem em que aparece para todos). */
export async function moveTagAction(id: number, dir: "up" | "down"): Promise<ActionResult> {
  const me = await requireAdmin();
  const [t] = await db.select().from(tags).where(eq(tags.id, id));
  if (!t) return fail("Tag não encontrada.");
  const list = await db.select().from(tags).where(eq(tags.groupKey, t.groupKey)).orderBy(asc(tags.sort), asc(tags.label));
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (const [pos, row] of list.entries()) if (row.sort !== pos) await tx.update(tags).set({ sort: pos }).where(eq(tags.id, row.id));
  });
  await logAudit(db, { userId: me.id, entity: "tag", action: "reordenou tags", field: t.groupKey, oldValue: String(i + 1), newValue: String(j + 1), meta: { tag: t.label } });
  revalidatePath("/admin/tags");
  return { ok: true, message: `${t.label} agora é a ${j + 1}ª tag do grupo.` };
}
