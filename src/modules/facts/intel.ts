import { eq, sql } from "drizzle-orm";
import { db, fieldDefs, fieldSuggestions } from "@/db";
import { FIELD_KEY_RE, keyFromLabel } from "@/config/facts";

export type FieldStat = { key: string; asked: number; answered: number; confirmed: number; changed: number; skipped: number; unknown: number; leads: number; coverage: number; answerRate: number; lift: number | null };

/** Números de uso de cada campo, dos últimos 90 dias (leads de teste não contam). Tudo no banco, sem custo. */
export async function fieldStats(): Promise<FieldStat[]> {
  const rows = await db.execute<Record<string, string | number | null>>(sql`
    with ev as (select key, count(*) filter (where event = 'asked') asked, count(*) filter (where event = 'answered') answered, count(*) filter (where event = 'confirmed') confirmed,
                       count(*) filter (where event = 'changed') changed, count(*) filter (where event = 'skipped') skipped, count(*) filter (where event = 'unknown') unknown
                from field_events where not is_test and created_at > now() - interval '90 days' group by key),
    worked as (select count(*) n, count(*) filter (where exists (select 1 from deals d where d.lead_id = l.id)) won from leads l where l.times_worked > 0 and not l.is_test),
    per as (select f.key, count(distinct f.lead_id) leads,
              count(distinct f.lead_id) filter (where exists (select 1 from deals d where d.lead_id = f.lead_id)) won
            from lead_facts f join leads l on l.id = f.lead_id where f.current and not l.is_test group by f.key),
    total as (select count(*) n from leads where not is_test)
    select d.key, coalesce(ev.asked, 0) asked, coalesce(ev.answered, 0) answered, coalesce(ev.confirmed, 0) confirmed, coalesce(ev.changed, 0) changed, coalesce(ev.skipped, 0) skipped, coalesce(ev.unknown, 0) unknown,
           coalesce(per.leads, 0) leads, (select n from total) total_leads, coalesce(per.won, 0) won_with, (select n from worked) worked_n, (select won from worked) worked_won
    from field_defs d left join ev on ev.key = d.key left join per on per.key = d.key`);
  return rows.map((r) => {
    const n = (k: string) => Number(r[k] ?? 0);
    const asked = n("asked"), answered = n("answered") + n("confirmed") + n("changed"), leads = n("leads"), total = Math.max(1, n("total_leads"));
    const base = n("worked_n") ? n("worked_won") / n("worked_n") : 0;
    const withRate = leads >= 5 ? n("won_with") / leads : null;
    return { key: String(r.key), asked, answered: n("answered"), confirmed: n("confirmed"), changed: n("changed"), skipped: n("skipped"), unknown: n("unknown"), leads, coverage: leads / total, answerRate: asked ? Math.min(1, answered / asked) : 0, lift: withRate !== null && base > 0 ? withRate / base : null };
  });
}

/**
 * Reordena a prioridade dos campos pelo que dá resultado: quem responde, quem não é "não sei" e quem anda junto com negociações.
 * Fórmula simples e visível: 40 de base + até 30 pela taxa de resposta + até 25 pelo impacto em negociações − até 25 por "não soube/pulou".
 * Campos sem dados ainda mantêm a prioridade atual.
 */
export async function recomputePriorities(): Promise<number> {
  const stats = await fieldStats();
  let n = 0;
  for (const s of stats) {
    if (s.asked < 8) continue;
    const bad = Math.min(1, (s.skipped + s.unknown) / Math.max(1, s.asked));
    const lift = s.lift === null ? 0 : Math.max(0, Math.min(1, (s.lift - 1) / 1.5));
    const p = Math.round(Math.max(10, Math.min(99, 40 + 30 * s.answerRate + 25 * lift - 25 * bad)));
    await db.update(fieldDefs).set({ priority: p }).where(eq(fieldDefs.key, s.key)); n++;
  }
  return n;
}

/** Temas que costumam aparecer nas observações e merecem virar campo (nome, tipo e opções já prontos). */
const CANDIDATES: { key: string; label: string; kind: "simnao" | "lista"; options?: string[]; scope?: "lead" | "person"; re: RegExp }[] = [
  { key: "frota_propria", label: "Tem frota própria", kind: "simnao", re: /\bfrota\b|\bcaminh(ao|oes|ões)\b|\bonibus\b|\bônibus\b/i },
  { key: "importa", label: "Compra importados", kind: "simnao", re: /\bimport(a|ado|ados|ação|acao)\b/i },
  { key: "representante", label: "Compra por representante", kind: "simnao", re: /\brepresentante\b|\bvendedor externo\b/i },
  { key: "licitacao", label: "Compra por licitação", kind: "simnao", re: /\blicita(c|ç)(ao|ão|oes|ões)\b|\bpregao\b|\bpregão\b/i },
  { key: "fabrica_propria", label: "Fabrica o próprio produto", kind: "simnao", re: /\bf(a|á)brica pr(o|ó)pria\b|\bfabrica(m)?\b/i },
  { key: "exige_certificado", label: "Exige certificado ou laudo", kind: "simnao", re: /\bcertificado\b|\blaudo\b|\biso ?9001\b|\brastreabilidade\b/i },
  { key: "sazonal", label: "Compra sazonal", kind: "simnao", re: /\bsazonal\b|\bsafra\b|\bentressafra\b|\bfim de ano\b/i },
  { key: "prazo_pagamento", label: "Prazo de pagamento que usa", kind: "lista", options: ["À vista", "28 dias", "30/60 dias", "Mais de 60 dias"], re: /\bboleto\b|\b28 ?dias\b|\b30 ?dias\b|\b(a|à) vista\b|\bprazo de pagamento\b/i },
  { key: "tem_estoque", label: "Mantém estoque próprio", kind: "simnao", re: /\bestoque\b/i },
  { key: "outras_unidades", label: "Tem outras unidades ou filiais", kind: "simnao", re: /\bfilial\b|\bfiliais\b|\boutra unidade\b|\bmatriz\b/i },
  { key: "prefere_visita", label: "Prefere receber visita", kind: "simnao", scope: "person", re: /\bprefere (a )?visita\b|\bquer visita\b|\bpede visita\b/i },
];

/** Procura nas observações dos vendedores o que se repete e ainda não é campo. Devolve quantas sugestões novas nasceram. */
export async function suggestFields(): Promise<number> {
  const texts = await db.execute<{ lead_id: number; t: string }>(sql`
    select l.id lead_id, l.notes t from leads l where l.notes is not null and length(l.notes) > 3 and not l.is_test
    union all select i.lead_id, i.note from interactions i where i.note is not null and length(i.note) > 3 and not i.is_test
    union all select c.lead_id, n from call_scripts c cross join lateral jsonb_array_elements_text(coalesce(c.notes, '[]'::jsonb)) n where not c.is_test`);
  const existing = new Set([...(await db.select({ key: fieldDefs.key }).from(fieldDefs)).map((r) => r.key), ...(await db.select({ key: fieldSuggestions.key }).from(fieldSuggestions)).map((r) => r.key)]);
  let made = 0;
  for (const c of CANDIDATES) {
    if (existing.has(c.key)) continue;
    const hits = new Map<number, string>();
    for (const r of texts) if (!hits.has(r.lead_id) && c.re.test(r.t)) hits.set(r.lead_id, r.t.slice(0, 140));
    if (hits.size < 3) continue; // pelo menos 3 leads diferentes falaram disso
    await db.insert(fieldSuggestions).values({ key: c.key, label: c.label, kind: c.kind, options: c.options ?? [], scope: c.scope ?? "lead", evidence: hits.size, examples: [...hits.values()].slice(0, 4) }).onConflictDoNothing();
    made++;
  }
  return made;
}

/** Aprova uma sugestão: ela vira campo do catálogo (ativo, no fim da fila de prioridade). */
export async function approveSuggestion(id: number): Promise<boolean> {
  const [s] = await db.select().from(fieldSuggestions).where(eq(fieldSuggestions.id, id)).limit(1);
  if (!s || s.status !== "pendente") return false;
  const key = FIELD_KEY_RE.test(s.key) ? s.key : keyFromLabel(s.label);
  const options = s.kind === "simnao" ? [] : s.options;
  await db.insert(fieldDefs).values({ key, label: s.label, kind: s.kind, options, scope: s.scope, groupName: "Outros", priority: 45, origin: "sugestao" }).onConflictDoNothing();
  await db.update(fieldSuggestions).set({ status: "aprovada" }).where(eq(fieldSuggestions.id, id));
  return true;
}
