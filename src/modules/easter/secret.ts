import "server-only";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const key = () => process.env.SESSION_SECRET || "chave-somente-para-desenvolvimento";
const k = () => new TextEncoder().encode(key());
export const EGG_COOKIE = "sdrfey_egg";
export const EGG_REWARD = 1000;

/** Dígito i (0–3) do cofre desta pessoa: sempre o mesmo, impossível de adivinhar de fora. */
export function vaultDigit(uid: number, i: number): number {
  return parseInt(createHmac("sha256", key()).update(`egg:${uid}`).digest("hex").slice(i * 2, i * 2 + 2), 16) % 10;
}
export const vaultCode = (uid: number) => [0, 1, 2, 3].map((i) => vaultDigit(uid, i));

export async function signEgg(data: Record<string, unknown>, ttl = "20m"): Promise<string> {
  return new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(k());
}
export async function readEgg<T = Record<string, unknown>>(t: string | undefined): Promise<(T & { iat: number }) | null> {
  if (!t) return null;
  try { return (await jwtVerify(t, k(), { algorithms: ["HS256"] })).payload as T & { iat: number }; } catch { return null; }
}
