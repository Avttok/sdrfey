"use server";

import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { chatStyles, coinLedger, db, shopPurchases } from "@/db";
import { EGG_SECRET_ITEMS } from "@/config/shop";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";
import { hasEgg } from "@/modules/achievements/stats";
import { notify } from "@/modules/notifications/notify";
import { EGG_COOKIE, EGG_REWARD, readEgg, signEgg } from "./secret";
import { EGG_KINDS, make, seal, shuffle, type EggKind } from "./puzzles";

export type { EggKind };
export type EggStep = { step: number; kind: EggKind; token: string; data?: unknown };
export type EggReply = { ok: boolean; message?: string; next?: EggStep; done?: { coins: number } };

/**
 * A caça aos ovos do rodapé: cada ovo quebrado devolve um token com a contagem; o décimo, em sequência, entrega a "chave" (cookie curto) que abre a porta.
 * O token só vive na memória da página: se a pessoa recarregar, a contagem recomeça do zero. Quem já achou o segredo não caça mais.
 */
export async function eggHuntAction(token: string | null): Promise<{ ok: boolean; n?: number; token?: string; open?: boolean }> {
  const me = await requireUser();
  if (await hasEgg(me.id)) return { ok: false };
  let n = 0;
  if (token) {
    const t = await readEgg<{ uid: number; n: number; k: string }>(token);
    if (!t || t.uid !== me.id || t.k !== "hunt") return { ok: false };
    n = t.n;
  }
  n += 1;
  if (n >= 10) {
    const jar = await cookies();
    jar.set(EGG_COOKIE, await signEgg({ uid: me.id, key: 1 }, "30m"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 30 });
    return { ok: true, n, open: true };
  }
  return { ok: true, n, token: await signEgg({ uid: me.id, n, k: "hunt" }, "30m") };
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

async function begin(uid: number, plan: EggKind[], i: number): Promise<EggStep> {
  const kind = plan[i];
  let r = make(kind);
  if (kind === "count" && !(r.data as { options: number[] }).options.includes(r.answer as number)) { const d = r.data as { options: number[] }; d.options[0] = r.answer as number; d.options = shuffle(d.options); }
  return { step: i + 1, kind, data: r.data, token: await signEgg({ uid, plan, i, h: seal(uid, i, r.answer), min: r.min }) };
}

/** Começa a jornada (precisa da chave e de não ter terminado). */
export async function eggBeginAction(): Promise<EggReply> {
  const me = await requireUser();
  if (!(await eggHasKey(me.id)) || (await eggIsDone(me.id))) return { ok: false };
  return { ok: true, next: await begin(me.id, shuffle([...EGG_KINDS]).slice(0, 5), 0) };
}

/** Confere uma etapa. Cada token é amarrado à pessoa, à etapa e ao horário: não dá para pular, adiantar nem copiar a resposta de outra pessoa. */
export async function eggSolveAction(token: string, answer: unknown): Promise<EggReply> {
  const me = await requireUser();
  if (!(await eggHasKey(me.id))) return { ok: false };
  const t = await readEgg<{ uid: number; plan: EggKind[]; i: number; h: string; min: number }>(token);
  if (!t || t.uid !== me.id) return { ok: false, message: "O feitiço se desfez. Recomece." };
  const waited = Date.now() / 1000 - t.iat;
  const f = fails.get(me.id);
  if (f && f.until > Date.now()) return { ok: false, message: "Muitas tentativas. Respire e volte em alguns minutos." };
  const miss = () => { const n = (f && f.until > Date.now() - 600_000 ? f.n : 0) + 1; fails.set(me.id, { n, until: n >= 8 ? Date.now() + 600_000 : 0 }); return { ok: false, message: "Não era isso…" }; };
  const given = typeof answer === "string" && t.plan[t.i] === "cipher" ? answer.trim().toUpperCase() : answer;
  if (waited < t.min || seal(me.id, t.i, given) !== t.h) return miss();
  if (t.i >= 4) {
    const done = await reward(me.id);
    return { ok: true, done: { coins: done ? EGG_REWARD : 0 } };
  }
  return { ok: true, next: await begin(me.id, t.plan, t.i + 1) };
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
