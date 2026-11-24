"use server";

import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, leadListItems, leadLists } from "@/db";
import { LIST_MAX_PER_USER, cleanListFilters, type ListFilters } from "@/config/lists";
import { requirePerm } from "@/modules/auth/guard";
import type { ActionResult } from "@/modules/leads/actions";
import { claimNext } from "@/modules/leads/sorter";
import { claimInactive } from "@/modules/sales/shuffler";
import { activeList, countList, fillList, listsUsed, sampleList, type ListKind } from "./queries";

const fail = (message: string): ActionResult => ({ ok: false, message });
const permOf = (k: ListKind) => (k === "sdr" ? "tab.lista_flow" : "tab.lista_flow_vendas");
const kindOf = (k: unknown): ListKind => (k === "vendas" ? "vendas" : "sdr");
const paths = (k: ListKind) => { revalidatePath(k === "sdr" ? "/lista-flow" : "/lista-flow-vendas"); revalidatePath(k === "sdr" ? "/atender" : "/shuffler-vendas"); };

export type ListPreview = { count: number; sample: { id: number; name: string; where: string; phones: number }[] };

/** Conta ao vivo e mostra uns exemplos, sem gravar nada. Leads que já estão em outra lista não entram. */
export async function previewListAction(kindRaw: unknown, raw: unknown, editId?: number): Promise<ListPreview> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  const f = cleanListFilters(raw);
  const own = await ownedId(me.id, kind, editId);
  const [count, sample] = await Promise.all([countList(kind, f, me.id, own), sampleList(kind, f, me.id, own)]);
  return { count, sample: sample.map((s) => ({ id: s.id, name: s.trade_name || s.company, where: [s.city, s.uf].filter(Boolean).join("/"), phones: s.phones })) };
}

const ownedId = async (userId: number, kind: ListKind, id?: number) => {
  if (!id) return undefined;
  const [l] = await db.select({ id: leadLists.id }).from(leadLists).where(and(eq(leadLists.id, id), eq(leadLists.ownerId, userId), eq(leadLists.kind, kind))).limit(1);
  return l?.id;
};

/** Salva a lista e reserva até 100 leads para ela (um lead só fica em uma lista por vez). */
export async function saveListAction(input: { id?: number; kind: ListKind; name: string; filters: ListFilters; activate: boolean }): Promise<ActionResult> {
  const kind = kindOf(input.kind);
  const me = await requirePerm(permOf(kind));
  const p = z.object({ id: z.number().int().optional(), name: z.string().trim().min(2, "Dê um nome à lista.").max(60) }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const filters = cleanListFilters(input.filters);
  const own = await ownedId(me.id, kind, p.data.id);
  if (p.data.id && !own) return fail("Lista não encontrada.");
  if (!own && (await listsUsed(me.id)) >= LIST_MAX_PER_USER) return fail(`Você já tem ${LIST_MAX_PER_USER} listas, que é o limite. Exclua, zere ou compartilhe uma (e espere alguém resgatar) para abrir espaço.`);
  if ((await countList(kind, filters, me.id, own)) === 0) return fail("Nenhum lead livre com esses filtros: os que já estão em outra lista não entram. Ajuste os filtros.");
  let reserved = 0;
  await db.transaction(async (tx) => {
    if (input.activate) await tx.update(leadLists).set({ active: false }).where(and(eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
    let id = own;
    if (id) {
      await tx.delete(leadListItems).where(eq(leadListItems.listId, id));
      await tx.update(leadLists).set({ name: p.data.name, filters, sharedAt: null, ...(input.activate ? { active: true } : {}) }).where(eq(leadLists.id, id));
    } else {
      [{ id }] = await tx.insert(leadLists).values({ ownerId: me.id, kind, name: p.data.name, filters, active: input.activate }).returning({ id: leadLists.id });
    }
    reserved = await fillList(tx, kind, filters, me.id, id);
  });
  paths(kind);
  const base = `${reserved} lead${reserved === 1 ? "" : "s"} reservado${reserved === 1 ? "" : "s"} na lista.`;
  return { ok: true, message: input.activate ? `Lista salva e ativa. ${base} O botão aparece no Shuffler.` : `Lista salva. ${base}` };
}

export async function setActiveListAction(kindRaw: unknown, id: number | null): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  await db.transaction(async (tx) => {
    await tx.update(leadLists).set({ active: false }).where(and(eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
    if (id) await tx.update(leadLists).set({ active: true }).where(and(eq(leadLists.id, id), eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind), isNull(leadLists.sharedAt)));
  });
  paths(kind);
  return { ok: true, message: id ? "Lista ativada." : "Lista desativada: o Shuffler volta a sortear de tudo." };
}

export async function deleteListAction(kindRaw: unknown, id: number): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  await db.delete(leadLists).where(me.isAdmin ? and(eq(leadLists.id, id), eq(leadLists.kind, kind)) : and(eq(leadLists.id, id), eq(leadLists.ownerId, me.id), eq(leadLists.kind, kind)));
  paths(kind);
  return { ok: true, message: "Lista excluída. Os leads voltaram a ficar livres." };
}

/** Zera a lista: devolve os leads e libera o espaço, mas mantém o nome e os filtros para remontar depois. */
export async function zeroListAction(kindRaw: unknown, id: number): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  const own = await ownedId(me.id, kind, id);
  if (!own) return fail("Lista não encontrada.");
  await db.transaction(async (tx) => {
    await tx.delete(leadListItems).where(eq(leadListItems.listId, own));
    await tx.update(leadLists).set({ active: false, sharedAt: null }).where(eq(leadLists.id, own));
  });
  paths(kind);
  return { ok: true, message: "Lista zerada: os leads foram liberados e o espaço está livre." };
}

/** Põe a lista na aba Compartilhadas. O espaço só é liberado quando outra pessoa resgatar. */
export async function shareListAction(kindRaw: unknown, id: number, share: boolean): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  const own = await ownedId(me.id, kind, id);
  if (!own) return fail("Lista não encontrada.");
  if (share) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(leadListItems).where(eq(leadListItems.listId, own));
    if (!r?.n) return fail("Esta lista está vazia: não há leads para compartilhar.");
    await db.update(leadLists).set({ sharedAt: new Date(), active: false }).where(eq(leadLists.id, own));
  } else await db.update(leadLists).set({ sharedAt: null }).where(eq(leadLists.id, own));
  paths(kind);
  return { ok: true, message: share ? "Lista compartilhada. Ela continua ocupando seu espaço até alguém resgatar." : "Compartilhamento cancelado: a lista voltou para você." };
}

/** Resgata uma lista compartilhada: ela passa a ser sua e libera o espaço de quem compartilhou. */
export async function claimSharedListAction(kindRaw: unknown, id: number): Promise<ActionResult> {
  const kind = kindOf(kindRaw);
  const me = await requirePerm(permOf(kind));
  if ((await listsUsed(me.id)) >= LIST_MAX_PER_USER) return fail(`Você já tem ${LIST_MAX_PER_USER} listas, que é o limite. Exclua ou zere uma para resgatar esta.`);
  const r = await db.update(leadLists).set({ ownerId: me.id, sharedAt: null, active: false })
    .where(and(eq(leadLists.id, id), eq(leadLists.kind, kind), isNotNull(leadLists.sharedAt), ne(leadLists.ownerId, me.id))).returning({ id: leadLists.id });
  if (!r[0]) return fail("Esta lista não está mais disponível: alguém já resgatou ou ela foi retirada.");
  paths(kind);
  return { ok: true, message: "Lista resgatada! Ela já está em Minhas listas; ative-a para usar no Shuffler." };
}

/** Botão "Sortear da lista" do Shuffler Prospecção. */
export async function startSdrListAction() {
  const me = await requirePerm("tab.comecar");
  const l = await activeList(me.id, "sdr");
  await claimNext(me.id, l ? { listId: l.id } : {});
  revalidatePath("/atender");
  redirect("/atender");
}

/** Botão "Sortear da lista" do Shuffler Vendas. */
export async function startSalesListAction() {
  const me = await requirePerm("tab.shuffler_vendas");
  const l = await activeList(me.id, "vendas");
  await claimInactive(me.id, l?.id);
  revalidatePath("/shuffler-vendas");
  redirect("/shuffler-vendas");
}
