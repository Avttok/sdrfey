"use server";

import { eq } from "drizzle-orm";
import { db, deals, leads, presence } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { describePath } from "@/config/activity";

/** Aviso de presença das telas comuns (o Shuffler faz o próprio). `visible` = aba em primeiro plano. */
export async function pingAction(path: string, visible: boolean): Promise<void> {
  const me = await requireUser();
  const base = describePath(String(path).slice(0, 200));
  let name: string | null = null;
  if (base.detail) {
    if (base.detail.kind === "lead") [{ company: name } = { company: null }] = await db.select({ company: leads.company }).from(leads).where(eq(leads.id, base.detail.id)).limit(1);
    else [{ company: name } = { company: null }] = await db.select({ company: leads.company }).from(deals).innerJoin(leads, eq(leads.id, deals.leadId)).where(eq(deals.id, base.detail.id)).limit(1);
  }
  const text = describePath(String(path).slice(0, 200), name).text;
  const activity = visible ? text : `Ausente · ${text}`;
  await db.insert(presence).values({ userId: me.id, activity, leadId: null, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: presence.userId, set: { activity, leadId: null, lastSeenAt: new Date() } });
}

/** O que consta agora para a própria pessoa (menu do perfil). Offline/antigo = null. */
export async function myActivityAction(): Promise<string | null> {
  const me = await requireUser();
  const [r] = await db.select({ a: presence.activity, t: presence.lastSeenAt }).from(presence).where(eq(presence.userId, me.id)).limit(1);
  return r && Date.now() - r.t.getTime() < 90_000 ? r.a : null;
}
