import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sdrfey_session";
const REMEMBER_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const SHORT_SECONDS = 60 * 60 * 12; // 12 horas

export type SessionPayload = {
  uid: number;
  /** Versão da sessão do usuário: trocar a senha derruba as outras sessões. */
  v: number;
  /** "Permanecer conectado". */
  rem: boolean;
};

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("Defina SESSION_SECRET nas variáveis de ambiente da Vercel.");
  }
  return new TextEncoder().encode(value || "chave-somente-para-desenvolvimento");
}

export const sessionMaxAge = (remember: boolean) => (remember ? REMEMBER_SECONDS : undefined);

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${payload.rem ? REMEMBER_SECONDS : SHORT_SECONDS}s`)
    .sign(secret());
}

export async function readToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.v !== "number") return null;
    return { uid: payload.uid, v: payload.v, rem: payload.rem === true };
  } catch {
    return null;
  }
}

/** Cookie "entrar com 1 clique": fica neste aparelho depois de sair da conta. Trocar a senha derruba (versão da sessão). */
export const QUICK_COOKIE = "sdrfey_quick";
export const QUICK_SECONDS = 60 * 60 * 24 * 30;
export type QuickPayload = { uid: number; v: number; name: string; rem: boolean };

export async function signQuick(p: QuickPayload): Promise<string> {
  return new SignJWT({ ...p, kind: "quick" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${QUICK_SECONDS}s`).sign(secret());
}
export async function readQuick(token: string): Promise<QuickPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.kind !== "quick" || typeof payload.uid !== "number" || typeof payload.v !== "number" || typeof payload.name !== "string") return null;
    return { uid: payload.uid, v: payload.v, name: payload.name, rem: payload.rem === true };
  } catch { return null; }
}
