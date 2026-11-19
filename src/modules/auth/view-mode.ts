"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_VIEW_COOKIE, getCurrentUser } from "./guard";

/** Só o Adm: escolhe se vê o sistema como Adm ("all") ou como um usuário comum com os mesmos cargos ("me"). Os privilégios de Adm não mudam. */
export async function setAdminViewAction(mode: "all" | "me"): Promise<{ ok: boolean }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return { ok: false };
  const jar = await cookies();
  if (mode === "me") jar.set(ADMIN_VIEW_COOKIE, "me", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  else jar.delete(ADMIN_VIEW_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}
