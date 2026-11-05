"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cities, db, reps } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin, requirePerm } from "@/modules/auth/guard";
import { cityLookupKey } from "@/modules/import/reps";
import type { ActionResult } from "@/modules/leads/actions";

const schema = z.object({
  id: z.number().int().optional(),
  sapCode: z.string().trim().min(1, "Informe o código SAP."),
  repName: z.string().trim().min(1, "Informe o nome do representante."),
  managerName: z.string().trim().nullable(), team: z.string().trim().nullable(), cnpj: z.string().trim().nullable(),
  address: z.string().trim().nullable(), cep: z.string().trim().nullable(),
  city: z.string().trim().min(1, "Informe a cidade."), uf: z.string().trim().toUpperCase().length(2, "UF com 2 letras."),
  active: z.boolean(),
});
export type RepInput = z.input<typeof schema>;
const LABELS: Record<string, string> = { sapCode: "Código SAP", repName: "Representante", managerName: "Gestor", team: "Equipe", cnpj: "CNPJ", address: "Endereço", cep: "CEP", city: "Cidade", uf: "UF", active: "Ativo" };

export async function saveRepAction(input: RepInput): Promise<ActionResult> {
  const me = await requirePerm("rep.edit");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const { id, ...d } = p.data;
  const key = cityLookupKey(d.city, d.uf).split("|");
  const [c] = await db.select({ lat: cities.lat, lon: cities.lon }).from(cities).where(and(eq(cities.nameNorm, key[0]), eq(cities.uf, key[1]))).limit(1);
  if (!c) return { ok: false, message: "Não achei essa cidade/UF no cadastro do IBGE. Confira a grafia." };
  const values = { ...d, lat: c.lat, lon: c.lon };
  if (id) {
    const [b] = await db.select().from(reps).where(eq(reps.id, id));
    if (!b) return { ok: false, message: "Representante não encontrado." };
    await db.update(reps).set(values).where(eq(reps.id, id));
    for (const k of Object.keys(LABELS) as (keyof typeof d)[]) if (String(b[k] ?? "") !== String(d[k] ?? "")) await logAudit(db, { userId: me.id, entity: "rep", action: "alterou representante", field: `${b.repName} · ${LABELS[k]}`, oldValue: b[k] as never, newValue: d[k] as never });
  } else {
    const [dup] = await db.select({ id: reps.id }).from(reps).where(eq(reps.sapCode, d.sapCode));
    if (dup) return { ok: false, message: "Já existe um representante com esse código SAP." };
    await db.insert(reps).values(values);
    await logAudit(db, { userId: me.id, entity: "rep", action: "criou representante", field: d.repName, newValue: d.sapCode });
  }
  revalidatePath("/representantes");
  return { ok: true, message: "Representante salvo." };
}

/** Exclui o representante por completo (só Adm). Fica no Registro. */
export async function deleteRepAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin();
  const [r] = await db.select().from(reps).where(eq(reps.id, id));
  if (!r) return { ok: false, message: "Representante não encontrado." };
  await db.transaction(async (tx) => {
    await logAudit(tx, { userId: me.id, entity: "rep", action: "excluiu representante", field: r.repName, oldValue: `SAP ${r.sapCode} · ${r.city}/${r.uf}`, newValue: null });
    await tx.delete(reps).where(eq(reps.id, id));
  });
  revalidatePath("/representantes");
  return { ok: true, message: `${r.repName} foi excluído.` };
}
