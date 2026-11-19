"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, users } from "@/db";
import { NAV } from "@/config/nav";
import { isFontKey } from "@/config/fonts";
import { isChoosableAccent } from "@/config/theme";
import { AVATAR_BY_KEY } from "@/config/avatars";
import { BANNER_BY_KEY } from "@/config/banners";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";

/** Troca a cor da própria pessoa. Valor vazio volta para a cor padrão do cargo. */
export async function setAvatarAction(key: string | null): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const next = key && AVATAR_BY_KEY.has(key) ? key : null;
  await db.update(users).set({ avatar: next }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "ícone de perfil", oldValue: me.avatar, newValue: next });
  revalidatePath("/", "layout");
  return { ok: true, message: next ? "Ícone de perfil salvo." : "Voltou para as iniciais." };
}

export async function setBannerAction(key: string | null): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const next = key && BANNER_BY_KEY.has(key) ? key : null;
  await db.update(users).set({ banner: next }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "banner do perfil", oldValue: me.banner, newValue: next });
  revalidatePath("/", "layout");
  return { ok: true, message: "Banner salvo." };
}

export async function setAccentAction(formData: FormData) {
  const me = await requireUser();
  const raw = String(formData.get("accent") ?? "");
  const next = isChoosableAccent(raw) ? raw : null;
  if (next === me.accent) return;

  await db.update(users).set({ accent: next }).where(eq(users.id, me.id));
  await logAudit(db, {
    userId: me.id,
    entity: "user",
    action: "alterou",
    field: "cor do sistema",
    oldValue: me.accent,
    newValue: next,
  });
  revalidatePath("/", "layout");
}

/** Cada pessoa altera o próprio nome de exibição. O login (usuário) nunca muda. */
export async function setDisplayNameAction(name: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const next = name.trim().replace(/\s+/g, " ");
  if (next.length < 2 || next.length > 60) return { ok: false, message: "Use de 2 a 60 caracteres." };
  if (next === me.name) return { ok: true };
  await db.update(users).set({ name: next }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "nome de exibição", oldValue: me.name, newValue: next });
  revalidatePath("/", "layout");
  return { ok: true, message: "Nome atualizado." };
}

/** Preferências da barra de navegação: posição (topo ou lateral) e ordem dos itens. */
export async function setNavPrefsAction(input: { layout: "top" | "side"; order: string[] }): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const layout = input.layout === "side" ? "side" : "top";
  const known = new Set(NAV.map((i) => i.href));
  const order = [...new Set(input.order.filter((h) => known.has(h)))];
  await db.update(users).set({ navLayout: layout, navOrder: order }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "barra de navegação", oldValue: `${me.navLayout} · ${me.navOrder.join(",")}`, newValue: `${layout} · ${order.join(",")}` });
  revalidatePath("/", "layout");
  return { ok: true, message: "Barra de navegação salva." };
}

/** Recolhe ou expande a barra lateral (só ícones quando recolhida). */
export async function setNavCollapsedAction(collapsed: boolean): Promise<void> {
  const me = await requireUser();
  if (me.navCollapsed === collapsed) return;
  await db.update(users).set({ navCollapsed: collapsed }).where(eq(users.id, me.id));
}

/** Fonte preferida da pessoa para todo o app. */
export async function setFontAction(font: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  if (!isFontKey(font)) return { ok: false, message: "Fonte inválida." };
  if (font === me.font) return { ok: true };
  await db.update(users).set({ font }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "fonte", oldValue: me.font, newValue: font });
  revalidatePath("/", "layout");
  return { ok: true, message: "Fonte atualizada." };
}

/** Mostrar o mapa do Google ao lado do lead ou só o link "Google Maps". */
export async function setMapModeAction(mode: "map" | "link"): Promise<{ ok: boolean; message?: string }> {
  const me = await requireUser();
  const next = mode === "link" ? "link" : "map";
  if (next === me.mapMode) return { ok: true };
  await db.update(users).set({ mapMode: next }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "alterou", field: "mapa do lead", oldValue: me.mapMode, newValue: next });
  revalidatePath("/", "layout");
  return { ok: true, message: "Preferência salva." };
}
