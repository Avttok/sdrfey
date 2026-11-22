import { eq, sql } from "drizzle-orm";
import { db, leads } from "@/db";
import { SEGMENT_WORDS } from "@/config/lists";
import { settingValue } from "@/modules/settings/get";

export type Reco = {
  segment: string; label: string;
  /** Escritas pelo Adm. */ curated: string[];
  /** Aprendidas das cotações e vendas desse tipo de cliente. */ learned: { name: string; deals: number; won: number }[];
};

/** Segmentos que o nome ou a atividade (CNAE) do lead sugerem. */
export function segmentsOf(text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(SEGMENT_WORDS).filter(([, v]) => v.words.some((w) => t.includes(w.toLowerCase()))).map(([k]) => k);
}

const like = (w: string) => `%${w.replace(/[%_\\]/g, "")}%`;

/** O que costuma ser oferecido a este tipo de cliente: sugestões do Adm + produtos mais cotados/fechados em empresas parecidas. */
export async function recosForLead(leadId: number): Promise<Reco[]> {
  const [lead] = await db.select({ company: leads.company, trade: leads.tradeName, api: leads.brasilApiData }).from(leads).where(eq(leads.id, leadId));
  if (!lead) return [];
  const cnae = String((lead.api as { cnae_fiscal_descricao?: string } | null)?.cnae_fiscal_descricao ?? "");
  const segs = segmentsOf(`${lead.company} ${lead.trade ?? ""} ${cnae}`).slice(0, 2);
  if (!segs.length) return [];
  const curatedAll = ((await settingValue("segment_recos")) ?? {}) as Record<string, string[]>;
  const out: Reco[] = [];
  for (const seg of segs) {
    const words = SEGMENT_WORDS[seg].words;
    const cond = sql.join(words.map((w) => sql`(l.company ilike ${like(w)} or l.trade_name ilike ${like(w)} or coalesce(l.brasilapi_data->>'cnae_fiscal_descricao', '') ilike ${like(w)})`), sql` or `);
    const rows = await db.execute<{ name: string; deals: number; won: number }>(sql`
      select coalesce(nullif(i.kind, ''), split_part(i.description, ' ', 1)) as name, count(distinct d.id)::int as deals, count(distinct d.id) filter (where d.stage = 'ganho')::int as won
      from deal_quote_items i join deals d on d.id = i.deal_id join leads l on l.id = d.lead_id
      where not d.is_test and l.id <> ${leadId} and (${cond})
      group by 1 having coalesce(nullif(i.kind, ''), split_part(i.description, ' ', 1)) <> ''
      order by won desc, deals desc limit 5`);
    out.push({ segment: seg, label: SEGMENT_WORDS[seg].label, curated: (curatedAll[seg] ?? []).slice(0, 6), learned: rows.map((r) => ({ name: r.name.toLowerCase(), deals: r.deals, won: r.won })) });
  }
  return out.filter((r) => r.curated.length || r.learned.length);
}
