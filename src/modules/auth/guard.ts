import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, users } from "@/db";
import { hasRole, type Role } from "@/config/roles";
import { SESSION_COOKIE, readToken, sessionMaxAge, signToken } from "./token";

export type CurrentUser = {
  id: number;
  username: string;
  name: string;
  roles: Role[];
  accent: string | null;
  mustChangePassword: boolean;
};

/** Grava o cookie de login. */
export async function setSessionCookie(userId: number, version: number, remember: boolean) {
  const token = await signToken({ uid: userId, v: version, rem: remember });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge(remember),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Quem está logado agora (ou null). Consulta o banco uma vez por requisição. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readToken(token) : null;
  if (!session) return null;

  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u || !u.active || u.sessionVersion !== session.v) return null;

  return {
    id: u.id,
    username: u.username,
    name: u.name,
    roles: u.roles,
    accent: u.accent,
    mustChangePassword: u.mustChangePassword,
  };
});

/** Use no topo de páginas e ações que exigem login. */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowMustChange) redirect("/trocar-senha");
  return user;
}

/** Igual a requireUser, mas exige um cargo mínimo. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user.roles, role)) redirect("/painel");
  return user;
}
