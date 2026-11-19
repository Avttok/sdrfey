"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { clearSessionCookie, requireUser, setSessionCookie } from "./guard";
import { AVATAR_BY_KEY } from "@/config/avatars";
import { isChoosableAccent } from "@/config/theme";
import { QUICK_COOKIE, QUICK_SECONDS, SESSION_COOKIE, readQuick, readToken, signQuick } from "./token";
import { checkPasswordRules, hashPassword, verifyPassword } from "./password";

export type FormState = { error?: string; ok?: string; fields?: { username?: string } };

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;
// Hash falso para gastar o mesmo tempo quando o usuário não existe.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.1p3m4ZxQ5eQy9o9ZfF0v2p0n8Q6u";

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) })
    .safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { error: "Informe usuário e senha." };
  const remember = formData.get("remember") === "on";
  const keep = { username: parsed.data.username }; // o React limpa o formulário após o envio; devolvemos o usuário

  const [user] = await db.select().from(users).where(eq(users.username, parsed.data.username)).limit(1);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Muitas tentativas. Tente de novo em ${mins} min.`, fields: keep };
  }

  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !valid) {
    if (user) {
      const attempts = user.failedAttempts + 1;
      const lock = attempts >= MAX_ATTEMPTS;
      await db
        .update(users)
        .set({
          failedAttempts: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        })
        .where(eq(users.id, user.id));
    }
    return { error: "Usuário ou senha incorretos.", fields: keep };
  }

  await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await logAudit(db, { userId: user.id, entity: "user", action: "entrou no sistema" });
  await setSessionCookie(user.id, user.sessionVersion, remember);

  redirect(user.mustChangePassword ? "/trocar-senha" : "/painel");
}

const quickOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: QUICK_SECONDS };
async function quickList() {
  const v = (await cookies()).get(QUICK_COOKIE)?.value;
  return v ? await readQuick(v) : [];
}

/** Sair: lembra a conta neste aparelho (até 6) para entrar de novo com 1 clique, sem senha. */
export async function logoutAction() {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value ? await readToken(jar.get(SESSION_COOKIE)!.value) : null;
  if (session) {
    const [u] = await db.select({ name: users.name, active: users.active, v: users.sessionVersion }).from(users).where(eq(users.id, session.uid)).limit(1);
    if (u?.active && u.v === session.v) {
      const list = (await quickList()).filter((a) => a.uid !== session.uid);
      jar.set(QUICK_COOKIE, await signQuick([{ uid: session.uid, v: session.v, name: u.name, rem: session.rem }, ...list]), quickOpts);
    }
  }
  if (session) await logAudit(db, { userId: session.uid, entity: "user", action: "saiu do sistema" });
  await clearSessionCookie();
  redirect("/login");
}

/** Entrar com 1 clique em uma das contas lembradas neste aparelho. */
export async function quickLoginAction(formData: FormData) {
  const uid = Number(formData.get("uid"));
  const list = await quickList();
  const q = list.find((a) => a.uid === uid);
  if (!q) redirect("/login");
  const [user] = await db.select().from(users).where(eq(users.id, q.uid)).limit(1);
  if (!user || !user.active || user.sessionVersion !== q.v || (user.lockedUntil && user.lockedUntil > new Date())) {
    const rest = list.filter((a) => a.uid !== uid);
    const jar = await cookies();
    if (rest.length) jar.set(QUICK_COOKIE, await signQuick(rest), quickOpts); else jar.delete(QUICK_COOKIE);
    redirect("/login");
  }
  await db.update(users).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await logAudit(db, { userId: user.id, entity: "user", action: "entrou no sistema (1 clique)" });
  await setSessionCookie(user.id, user.sessionVersion, q.rem);
  redirect(user.mustChangePassword ? "/trocar-senha" : "/painel");
}

/** Tira uma conta (ou todas, sem `uid`) da lista deste aparelho. */
export async function forgetQuickAction(formData: FormData) {
  const uid = Number(formData.get("uid"));
  const jar = await cookies();
  const rest = Number.isFinite(uid) && formData.get("uid") ? (await quickList()).filter((a) => a.uid !== uid) : [];
  if (rest.length) jar.set(QUICK_COOKIE, await signQuick(rest), quickOpts); else jar.delete(QUICK_COOKIE);
  redirect("/login");
}

const passwordSchema = z
  .object({ current: z.string().min(1), next: z.string(), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "A confirmação não é igual à nova senha.", path: ["confirm"] });

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser({ allowMustChange: true });
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { current, next } = parsed.data;

  const [row] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { error: "A senha atual está incorreta." };
  if (current === next) return { error: "A nova senha precisa ser diferente da atual." };
  const rule = checkPasswordRules(next);
  if (rule) return { error: rule };

  const version = row.sessionVersion + 1; // derruba as outras sessões abertas
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: version })
    .where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "trocou a própria senha" });
  // mantém a escolha de "permanecer conectado" que a pessoa fez no login
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const remember = token ? ((await readToken(token))?.rem ?? false) : false;
  await setSessionCookie(me.id, version, remember);

  if (row.mustChangePassword) redirect("/painel");
  return { ok: "Senha alterada com sucesso." };
}

/**
 * Primeiro acesso: em um passo só a pessoa define senha, nome, ícone de perfil e cor.
 * (O tema claro/noturno fica no navegador, não no servidor.)
 */
export async function firstAccessAction(input: { current: string; next: string; confirm: string; name: string; avatar: string | null; accent: string | null }): Promise<FormState> {
  const me = await requireUser({ allowMustChange: true });
  if (!me.mustChangePassword) return { error: "Este acesso já foi concluído." };
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return { error: "O nome precisa ter de 2 a 60 caracteres." };
  if (input.next !== input.confirm) return { error: "A confirmação não é igual à nova senha." };
  const [row] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!row || !(await verifyPassword(String(input.current ?? ""), row.passwordHash))) return { error: "A senha provisória está incorreta." };
  if (input.current === input.next) return { error: "A nova senha precisa ser diferente da provisória." };
  const rule = checkPasswordRules(input.next);
  if (rule) return { error: rule };
  const avatar = input.avatar && AVATAR_BY_KEY.has(input.avatar) ? input.avatar : null;
  const accent = isChoosableAccent(input.accent) ? input.accent : null;
  const version = row.sessionVersion + 1;
  await db.update(users).set({ passwordHash: await hashPassword(input.next), mustChangePassword: false, sessionVersion: version, name, avatar, accent }).where(eq(users.id, me.id));
  await logAudit(db, { userId: me.id, entity: "user", action: "concluiu o primeiro acesso", meta: { nome: name !== me.name, icone: !!avatar, cor: !!accent } });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const remember = token ? ((await readToken(token))?.rem ?? false) : false;
  await setSessionCookie(me.id, version, remember);
  redirect("/painel");
}
