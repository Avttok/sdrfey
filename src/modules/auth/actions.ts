"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { clearSessionCookie, requireUser, setSessionCookie } from "./guard";
import { SESSION_COOKIE, readToken } from "./token";
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

export async function logoutAction() {
  await clearSessionCookie();
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
