"use server";

import { and, eq, sql } from "drizzle-orm";
import { db, fieldDefs, fieldEvents, leadFacts, leadPeople, leads } from "@/db";
import { cleanValue, MULTI_SEP, splitMulti, type FactView, type FieldDefView, type FieldKind, type FieldScope } from "@/config/facts";
import { logAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/guard";

export type FactMode = "auto" | "keep" | "replace" | "both";
export type FactResult =
  | { ok: true; state: "new" | "confirmed" | "replaced" | "merged" | "kept"; fact: FactView }
  | { ok: true; state: "conflict"; old: FactView; value: string }
  | { ok: false; message: string };

const MIRROR: Record<string, "preferredChannel" | "bestTime" | "roleKind"> = { canal_preferido: "preferredChannel", melhor_horario: "bestTime", papel: "roleKind" };

/**
 * Guarda uma resposta do atendimento.
 * - Campo vazio: grava (Informado).  - Mesmo valor: confirma e sobe a confiança.
 * - Valor diferente: com `review` devolve o conflito para a pessoa decidir na hora; sem `review` o novo vale e o antigo vira histórico.
 */
export async function recordFactAction(input: { leadId: number; key: string; value: string; personId?: number | null; mode?: FactMode; review?: boolean; runId?: string | null; isTest?: boolean }): Promise<FactResult> {
  const me = await requireUser();
  const [def] = await db.select().from(fieldDefs).where(and(eq(fieldDefs.key, String(input.key)), eq(fieldDefs.active, true))).limit(1);
  if (!def) return { ok: false, message: "Esse campo não existe mais." };
  const dv: Pick<FieldDefView, "kind" | "options"> = { kind: def.kind as FieldKind, options: def.options ?? [] };
  const value = cleanValue(dv, input.value);
  if (!value) return { ok: false, message: "Resposta inválida para este campo." };
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, input.leadId)).limit(1);
  if (!lead) return { ok: false, message: "Lead não encontrado." };
  const personId = (def.scope as FieldScope) === "person" ? input.personId ?? null : null;
  if (personId) { const [p] = await db.select({ id: leadPeople.id }).from(leadPeople).where(and(eq(leadPeople.id, personId), eq(leadPeople.leadId, input.leadId))).limit(1); if (!p) return { ok: false, message: "Contato não encontrado." }; }
  const mode = input.mode ?? "auto";

  return db.transaction(async (tx) => {
    const cur = await tx.select().from(leadFacts).where(and(eq(leadFacts.leadId, input.leadId), eq(leadFacts.key, def.key), eq(leadFacts.current, true), personId ? eq(leadFacts.personId, personId) : sql`${leadFacts.personId} is null`)).for("update").limit(1);
    const old = cur[0];
    const view = (r: { value: string; confidence: number; createdAt: Date; confirmedAt: Date | null; personId: number | null }): FactView => ({ key: def.key, value: r.value, confidence: Math.min(3, Math.max(1, r.confidence)) as 1 | 2 | 3, at: (r.confirmedAt ?? r.createdAt).toISOString(), personId: r.personId, by: me.name });
    const event = async (e: string) => { await tx.insert(fieldEvents).values({ key: def.key, leadId: input.leadId, userId: me.id, event: e, isTest: !!input.isTest }); };
    const mirror = async (v: string) => { const col = MIRROR[def.key]; if (col && personId) await tx.update(leadPeople).set({ [col]: v, confirmedAt: new Date() }).where(eq(leadPeople.id, personId)); };
    const insert = async (v: string, confidence: number) => {
      const [r] = await tx.insert(leadFacts).values({ leadId: input.leadId, personId, key: def.key, value: v, confidence, source: "roteiro", runId: input.runId ?? null, userId: me.id }).returning();
      await mirror(v);
      if (!input.isTest) await logAudit(tx, { userId: me.id, leadId: input.leadId, entity: "lead", action: old ? "atualizou um dado do lead" : "guardou um dado do lead", field: def.label, oldValue: old?.value ?? null, newValue: v });
      return view(r);
    };

    if (!old) { await event("answered"); return { ok: true, state: "new", fact: await insert(value, 1) } as FactResult; }

    const same = old.value === value;
    if (same || mode === "keep") {
      const [r] = await tx.update(leadFacts).set({ confidence: Math.min(3, old.confidence + 1), confirmedAt: new Date(), userId: me.id }).where(eq(leadFacts.id, old.id)).returning();
      await event("confirmed"); await mirror(old.value);
      return { ok: true, state: same ? "confirmed" : "kept", fact: view(r) } as FactResult;
    }
    // várias escolhas: sem revisão, o que o cliente acabou de dizer se soma ao que já havia
    if (mode === "auto" && def.kind === "multi" && !input.review) {
      const next = [...new Set([...splitMulti(old.value), ...splitMulti(value)])].join(MULTI_SEP);
      if (next === old.value) { const [r] = await tx.update(leadFacts).set({ confidence: Math.min(3, old.confidence + 1), confirmedAt: new Date(), userId: me.id }).where(eq(leadFacts.id, old.id)).returning(); await event("confirmed"); return { ok: true, state: "confirmed", fact: view(r) } as FactResult; }
      await tx.update(leadFacts).set({ current: false }).where(eq(leadFacts.id, old.id)); await event("changed");
      return { ok: true, state: "merged", fact: await insert(next, 1) } as FactResult;
    }
    if (mode === "auto" && input.review) return { ok: true, state: "conflict", old: view(old), value } as FactResult;

    let next = value;
    if (mode === "both") {
      const kind = def.kind as FieldKind;
      next = kind === "multi" ? [...new Set([...splitMulti(old.value), ...splitMulti(value)])].join(MULTI_SEP) : kind === "texto" ? `${old.value}; ${value}`.slice(0, 200) : value;
    }
    await tx.update(leadFacts).set({ current: false }).where(eq(leadFacts.id, old.id));
    await event("changed");
    return { ok: true, state: mode === "both" && next !== value ? "merged" : "replaced", fact: await insert(next, 1) } as FactResult;
  });
}

/** Registra que uma pergunta foi feita, pulada ou o cliente não soube dizer (alimenta a inteligência). */
export async function fieldEventsAction(items: { key: string; leadId: number; event: "asked" | "skipped" | "unknown"; isTest?: boolean }[]): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const rows = items.slice(0, 20).filter((i) => /^[a-z][a-z0-9_]{1,30}$/.test(i.key) && Number.isInteger(i.leadId));
  if (!rows.length) return { ok: true };
  const keys = new Set((await db.select({ key: fieldDefs.key }).from(fieldDefs)).map((k) => k.key));
  const ok = rows.filter((r) => keys.has(r.key));
  if (ok.length) await db.insert(fieldEvents).values(ok.map((r) => ({ key: r.key, leadId: r.leadId, userId: me.id, event: r.event, isTest: !!r.isTest })));
  return { ok: true };
}
