"use server";

import { plural } from "@/lib/format";
import { and, eq, sql } from "drizzle-orm";
import { getSettings } from "@/modules/settings/get";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, leadChannels, presence } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requirePerm, requireUser } from "@/modules/auth/guard";
import { refreshInfo } from "@/modules/enrich/refresh";
import { addChannel, discardLead, markStarted, resetLead, saveAttendance, type SaveInput } from "./attend";
import { attendLead, claimNext, releaseExpiredLocks, releaseLead, skipLead, touchLock, UserError } from "./sorter";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

/** Transforma erros de regra em mensagem amigável; erros inesperados viram mensagem genérica (e vão para o log do servidor). */
async function guard(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message };
    // redirect() do Next lança um erro especial que precisa seguir adiante
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error(e);
    return { ok: false, message: "Algo deu errado. Tente de novo; se repetir, avise o Adm." };
  }
}

/** "Shuffler": sorteia o próximo lead (ou volta ao que já está em mãos). */
export async function startAction() {
  const me = await requirePerm("tab.comecar");
  await claimNext(me.id);
  revalidatePath("/atender"); // limpa a tela "Bora?" guardada no navegador, senão o redirect para a mesma página não troca de etapa
  redirect("/atender");
}

/** "ATENDER" em um lead específico (aba Leads ou Histórico): mesmo fluxo do sorteio. */
export async function attendAction(leadId: number): Promise<ActionResult> {
  const me = await requirePerm("tab.comecar");
  return guard(async () => {
    await attendLead(me.id, leadId);
    revalidatePath("/atender");
    redirect("/atender");
  });
}

export async function skipAction(leadId: number): Promise<ActionResult> {
  const me = await requirePerm("tab.comecar");
  return guard(async () => {
    await skipLead(me.id, leadId);
    revalidatePath("/atender");
  });
}

export async function releaseAction(leadId: number): Promise<ActionResult> {
  const me = await requirePerm("tab.comecar");
  return guard(async () => {
    await releaseLead(me.id, leadId);
    redirect("/atender");
  });
}

export async function saveAction(input: SaveInput): Promise<ActionResult> {
  const me = await requirePerm("tab.comecar");
  return guard(async () => {
    await saveAttendance(me.id, input);
    revalidatePath("/atender");
    return { ok: true, message: "Atendimento salvo." };
  });
}

export async function discardAction(leadId: number, reason: string): Promise<ActionResult> {
  const me = await requirePerm("tab.comecar");
  return guard(async () => {
    await discardLead(me.id, leadId, reason);
    revalidatePath("/atender");
    return { ok: true, message: "Lead descartado." };
  });
}

export async function resetLeadAction(leadId: number): Promise<ActionResult> {
  const me = await requireUser();
  return guard(async () => {
    await resetLead(me.id, leadId);
    revalidatePath("/atender");
    revalidatePath("/leads");
    return { ok: true, message: "Lead resetado: tags, observação e interações apagadas." };
  });
}

export async function startedAction(leadId: number): Promise<void> {
  const me = await requireUser();
  await markStarted(me.id, leadId);
}

export async function addChannelAction(leadId: number, kind: "phone" | "email", value: string): Promise<ActionResult> {
  const me = await requireUser();
  return guard(async () => {
    const added = await addChannel(me.id, leadId, kind, value);
    revalidatePath("/atender");
    return { ok: true, message: added ? "Adicionado ao lead." : "Esse contato já existe neste lead." };
  });
}

export async function markWrongAction(leadId: number, channelId: number, wrong: boolean): Promise<ActionResult> {
  const me = await requireUser();
  return guard(async () => {
    const [c] = await db.select().from(leadChannels).where(and(eq(leadChannels.id, channelId), eq(leadChannels.leadId, leadId)));
    if (!c) throw new UserError("Contato não encontrado.");
    await db.update(leadChannels).set({ wrong }).where(eq(leadChannels.id, channelId));
    await logAudit(db, { userId: me.id, leadId, entity: "lead", action: wrong ? "marcou contato como errado" : "desmarcou contato errado", field: c.kind === "phone" ? "Telefones" : "E-mails", oldValue: wrong ? "ok" : "errado", newValue: wrong ? "errado" : "ok", meta: { contato: c.value } });
    revalidatePath("/atender");
  });
}

export async function removeChannelAction(leadId: number, channelId: number): Promise<ActionResult> {
  const me = await requireUser();
  return guard(async () => {
    const [c] = await db.select().from(leadChannels).where(and(eq(leadChannels.id, channelId), eq(leadChannels.leadId, leadId)));
    if (!c) throw new UserError("Contato não encontrado.");
    await db.delete(leadChannels).where(eq(leadChannels.id, channelId));
    await logAudit(db, { userId: me.id, leadId, entity: "lead", action: "removeu contato", field: c.kind === "phone" ? "Telefones" : "E-mails", oldValue: c.value, newValue: null });
    revalidatePath("/atender");
  });
}

export async function refreshInfoAction(leadId: number): Promise<ActionResult> {
  const me = await requireUser();
  if (!me.permissions["tab.comecar"] && !me.permissions["tab.leads"]) return { ok: false, message: "Sem permissão." };
  return guard(async () => {
    const r = await refreshInfo(leadId, me.id);
    revalidatePath("/atender");
    revalidatePath(`/leads/${leadId}`);
    return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.message };
  });
}

/** Batimento: mantém o lead preso a quem está atendendo e mostra a pessoa como online. */
/** `active` = a pessoa mexeu na tela desde o último batimento. Só atividade real renova o prazo do lead
 *  (aba aberta e parada não segura o lead). Devolve false quando o lead não está mais com você. */
export async function heartbeatAction(leadId: number | null, activity: string, active = true): Promise<boolean> {
  const me = await requireUser();
  let held = true;
  if (leadId) {
    const [l] = await db.execute<{ mine: boolean; fresh: boolean }>(sql`select (locked_by = ${me.id}) as mine, (locked_at >= now() - make_interval(mins => ${(await getSettings()).lock_minutes})) as fresh from leads where id = ${leadId}`);
    if (!l?.mine) held = false;
    else if (!l.fresh) { await releaseExpiredLocks(); held = false; }
    else if (active) await touchLock(me.id, leadId);
  }
  await db
    .insert(presence)
    .values({ userId: me.id, activity, leadId, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: presence.userId, set: { activity, leadId, lastSeenAt: new Date() } });
  return held;
}

/** Modo teste: o Adm atende leads falsos, sem tocar nas métricas reais. */
export async function startTestAction() {
  const me = await requireUser();
  if (!me.roles.includes("admin")) redirect("/painel");
  await claimNext(me.id, { test: true });
  redirect("/atender");
}
