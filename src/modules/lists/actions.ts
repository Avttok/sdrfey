"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, leadLists } from "@/db";
import { cleanListFilters, type ListFilters } from "@/config/lists";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { claimNext } from "@/modules/leads/sorter";
import { claimInactive } from "@/modules/sales/shuffler";
import { activeList, countList, sampleList, type ListKind } from "./queries";

const fail = (message: string): ActionResult => ({ ok: false, message });
const permOf = (k: ListKind) => (k === "sdr" ? "tab.lista_flow" : "tab.lista_flow_vendas");
const kindOf = (k: unknown): ListKind => (k === "vendas" ? "vendas" : "sdr");
const paths = (k: ListKind) => { revalidatePath(k === "sdr" ? "/lista-flow" : "/lista-flow-vendas"); revalidatePath(k === "sdr" ? "/atender" : "/shuffler-vendas"); };

export type ListPreview = { count: number; sample: { id: number; name: string; where: string; phones: number }[] };

/** Conta ao vivo e mostra uns exemplos, sem gravar nada. */
export async function previewListAction(kindRaw: unknown, raw: unknown): Promise<ListPreview> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  const f = cleanListFilters(raw);
  const [count, sample] = await Promise.all([countList(kind, f, me.id), sampleList(kind, f, me.id)]);
  return { count, sample: sample.map((s) => ({ id: s.id, name: s.trade_name || s.company, where: [s.city, s.uf].filter(Boolean).join("/"), phones: s.phones })) };
}

export async function saveListAction(input: { id?: number; kind: ListKind; name: string; filters: ListFilters; activate: boolean }): Promise<ActionResult> {
  const kind = kindOf(input.kind);
  const me = await requirePerm(permOf(kind));
  const p = z.object({ id: z.number().int().optional(), name: z.string().trim().min(2, "Dê um nome à lista.").max(60) }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const filters = cleanListFilters(input.filters);
  const count = await countList(kind, filters, me.id);
  if (input.activate && count === 0) return fail("Esta lista está vazia agora; ajuste os filtros antes de ativá-la.");
  await db.transaction(async (tx) => {
    if (input.activate) await tx.update(leadLists).set({ active: false }).where(and(eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
    if (p.data.id) await tx.update(leadLists).set({ name: p.data.name, filters, ...(input.activate ? { active: true } : {}) }).where(and(eq(leadLists.id, p.data.id), eq(leadLists.ownerId, me.id)));
    else await tx.insert(leadLists).values({ ownerId: me.id, kind, name: p.data.name, filters, active: input.activate });
  });
  paths(kind);
  return { ok: true, message: input.activate ? "Lista salva e ativa: o botão aparece no Shuffler." : "Lista salva." };
}

export async function setActiveListAction(kindRaw: unknown, id: number | null): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  await db.transaction(async (tx) => {
    await tx.update(leadLists).set({ active: false }).where(and(eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
    if (id) await tx.update(leadLists).set({ active: true }).where(and(eq(leadLists.id, id), eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
  });
  paths(kind);
  return { ok: true, message: id ? "Lista ativada." : "Lista desativada: o Shuffler volta a sortear de tudo." };
}

export async function deleteListAction(kindRaw: unknown, id: number): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  await db.delete(leadLists).where(and(eq(leadLists.id, id), eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
  paths(kind);
  return { ok: true, message: "Lista excluída." };
}

/** Botão "Sortear da lista" do Shuffler SDR. */
export async function startSdrListAction() {
  const me = await requirePerm("tab.comecar");
  const l = await activeList(me.id, "sdr");
  await claimNext(me.id, l ? { list: l.filters } : {});
  revalidatePath("/atender");
  redirect("/atender");
}

/** Botão "Sortear da lista" do Shuffler de Vendas. */
export async function startSalesListAction() {
  const me = await requirePerm("tab.shuffler_vendas");
  const l = await activeList(me.id, "vendas");
  await claimInactive(me.id, l?.filters);
  revalidatePath("/shuffler-vendas");
  redirect("/shuffler-vendas");
}
