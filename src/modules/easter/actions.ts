"use server";

import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { chatStyles, coinLedger, db, shopPurchases } from "@/db";
import { EGG_SECRET_ITEMS } from "@/config/shop";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";
import { notify } from "@/modules/notifications/notify";
import { EGG_COOKIE, EGG_REWARD, readEgg, signEgg, vaultCode, vaultDigit } from "./secret";

export type EggStep = { step: number; token: string; data?: unknown };
export type EggReply = { ok: boolean; message?: string; next?: EggStep; digit?: number; done?: { coins: number } };

/** A "chave": quem encontra a batida secreta ganha um cookie curto que abre a porta. */
export async function eggKnockAction(): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const jar = await cookies();
  jar.set(EGG_COOKIE, await signEgg({ uid: me.id, key: 1 }, "30m"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 30 });
  return { ok: true };
}

export async function eggHasKey(uid: number): Promise<boolean> {
  if ((await requireUser()).id !== uid) return false;
  const p = await readEgg<{ uid: number; key: number }>((await cookies()).get(EGG_COOKIE)?.value);
  return !!p && p.uid === uid && p.key === 1;
}
export async function eggIsDone(uid: number): Promise<boolean> {
  if ((await requireUser()).id !== uid) return false;
  const [r] = await db.select({ id: coinLedger.id }).from(coinLedger).where(and(eq(coinLedger.userId, uid), eq(coinLedger.ref, "egg:done")));
  return !!r;
}

/** Freio contra tentativa e erro: 8 erros seguidos travam a pessoa por 10 minutos (por instância; basta para dissuadir). */
const fails = new Map<number, { n: number; until: number }>();

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const rot13 = (s: string) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + 13) % 26) + 65));

async function begin(uid: number, step: number): Promise<EggStep> {
  if (step === 1) { const pattern = Array.from({ length: 5 }, () => Math.floor(Math.random() * 4)); return { step, data: pattern, token: await signEgg({ uid, step, pattern }) }; }
  if (step === 2) return { step, data: rot13("RUAN"), token: await signEgg({ uid, step }) };
  if (step === 3) return { step, token: await signEgg({ uid, step }) };
  if (step === 4) { const nums = shuffle([3, 8, 12, 21, 40]); return { step, data: nums, token: await signEgg({ uid, step }) }; }
  return { step: 5, token: await signEgg({ uid, step: 5 }) };
}

/** Começa a jornada (precisa da chave e de não ter terminado). */
export async function eggBeginAction(): Promise<EggReply> {
  const me = await requireUser();
  if (!(await eggHasKey(me.id)) || (await eggIsDone(me.id))) return { ok: false };
  return { ok: true, next: await begin(me.id, 1) };
}

/** Confere uma etapa. Cada token é amarrado à pessoa, à etapa e ao horário: não dá para pular nem adiantar. */
export async function eggSolveAction(token: string, answer: unknown): Promise<EggReply> {
  const me = await requireUser();
  if (!(await eggHasKey(me.id))) return { ok: false };
  const t = await readEgg<{ uid: number; step: number; pattern?: number[] }>(token);
  if (!t || t.uid !== me.id) return { ok: false, message: "O feitiço se desfez. Recomece." };
  const waited = Date.now() / 1000 - t.iat;
  const f = fails.get(me.id);
  if (f && f.until > Date.now()) return { ok: false, message: "Muitas tentativas. Respire e volte em alguns minutos." };
  const wrong = { ok: false, message: "Não era isso…" };
  const miss = () => { const n = (f && f.until > Date.now() - 600_000 ? f.n : 0) + 1; fails.set(me.id, { n, until: n >= 8 ? Date.now() + 600_000 : 0 }); return wrong; };
  switch (t.step) {
    case 1: if (waited < 4 || !Array.isArray(answer) || JSON.stringify(answer) !== JSON.stringify(t.pattern)) return miss(); break;
    case 2: if (typeof answer !== "string" || answer.trim().toUpperCase() !== "RUAN") return miss(); break;
    case 3: if (waited < 3 || answer !== "held") return miss(); break;
    case 4: if (JSON.stringify(answer) !== JSON.stringify([3, 8, 12, 21, 40])) return miss(); break;
    case 5: {
      if (waited < 2 || JSON.stringify(answer) !== JSON.stringify(vaultCode(me.id))) return miss();
      const done = await reward(me.id);
      return { ok: true, done: { coins: done ? EGG_REWARD : 0 } };
    }
    default: return { ok: false };
  }
  return { ok: true, digit: vaultDigit(me.id, t.step - 1), next: await begin(me.id, t.step + 1) };
}

async function reward(uid: number): Promise<boolean> {
  const got = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${uid}::bigint + 7000000)`);
    const [have] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(and(eq(coinLedger.userId, uid), eq(coinLedger.ref, "egg:done")));
    if (have) return false;
    await tx.insert(coinLedger).values({ userId: uid, amount: EGG_REWARD, reason: "Segredo descoberto", ref: "egg:done" });
    const equipped: Record<string, string> = {};
    for (const it of EGG_SECRET_ITEMS) {
      await tx.insert(shopPurchases).values({ userId: uid, itemKey: it.key, price: 0 }).onConflictDoNothing();
      equipped[it.cat] = it.key;
    }
    await tx.insert(chatStyles).values({ userId: uid, equipped }).onConflictDoUpdate({ target: chatStyles.userId, set: { equipped: sql`${chatStyles.equipped} || ${JSON.stringify(equipped)}::jsonb` } });
    await logAudit(tx, { userId: uid, entity: "shop", action: "descobriu o segredo", field: "Easter egg", newValue: `${EGG_REWARD} moedas` });
    return true;
  });
  if (got) await notify(uid, { kind: "conquista", title: "Você encontrou o segredo! 🥚", body: `+${EGG_REWARD} moedas e 4 itens exclusivos da loja, já equipados.`, href: "/" });
  return got;
}
