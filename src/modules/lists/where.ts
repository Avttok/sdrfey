import { sql, type SQL } from "drizzle-orm";
import { SEGMENT_WORDS, type ListFilters } from "@/config/lists";

const like = (w: string) => `%${w.replace(/[%_\\]/g, "").trim()}%`;

/** Condição SQL de uma lista, para um lead com apelido `l`. Tudo parametrizado (nada de texto do usuário vira SQL). */
export function listCondition(f: ListFilters): SQL {
  const c: SQL[] = [];
  if (f.ufs.length) c.push(sql`l.uf in (${sql.join(f.ufs.map((u) => sql`${u}`), sql`, `)})`);
  if (f.city.trim()) c.push(sql`l.city ilike ${like(f.city)}`);
  const words = [...f.segments.flatMap((s) => SEGMENT_WORDS[s]?.words ?? []), ...f.words.split(",").map((w) => w.trim()).filter((w) => w.length >= 3)].slice(0, 40);
  if (words.length) c.push(sql`(${sql.join(words.map((w) => sql`(l.company ilike ${like(w)} or l.trade_name ilike ${like(w)} or coalesce(l.brasilapi_data->>'cnae_fiscal_descricao', '') ilike ${like(w)})`), sql` or `)})`);
  const byGroup = new Map<string, string[]>();
  for (const t of f.tags) { const [g, k] = t.split(":"); byGroup.set(g, [...(byGroup.get(g) ?? []), k]); }
  for (const [g, keys] of byGroup) c.push(sql`exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = ${g} and t.key in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)}))`);
  if (f.phone) c.push(sql`exists (select 1 from lead_channels ch where ch.lead_id = l.id and ch.kind = 'phone' and not ch.wrong)`);
  if (f.email) c.push(sql`exists (select 1 from lead_channels ch where ch.lead_id = l.id and ch.kind = 'email' and not ch.wrong)`);
  if (f.person) c.push(sql`exists (select 1 from lead_people p where p.lead_id = l.id)`);
  if (f.enriched === "yes") c.push(sql`l.enriched_at is not null`);
  if (f.enriched === "no") c.push(sql`l.enriched_at is null`);
  if (f.untouched) c.push(sql`not exists (select 1 from interactions i where i.lead_id = l.id)`);
  if (f.active) c.push(sql`upper(coalesce(l.registration_status, '')) like 'ATIV%'`);
  if (f.mobile) c.push(sql`exists (select 1 from lead_channels ch where ch.lead_id = l.id and ch.kind = 'phone' and not ch.wrong and length(regexp_replace(regexp_replace(ch.value, '[^0-9]', '', 'g'), '^55(?=[0-9]{10,11}$)', '')) = 11)`);
  if (f.age !== "any") {
    const opened = sql`(case when l.brasilapi_data->>'data_inicio_atividade' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (l.brasilapi_data->>'data_inicio_atividade')::date end)`;
    if (f.age === "new") c.push(sql`${opened} > current_date - interval '2 years'`);
    if (f.age === "mid") c.push(sql`${opened} between current_date - interval '10 years' and current_date - interval '2 years'`);
    if (f.age === "old") c.push(sql`${opened} < current_date - interval '10 years'`);
  }
  if (f.quiet) c.push(sql`not exists (select 1 from interactions i where i.lead_id = l.id and i.at > now() - make_interval(days => ${f.quiet}))`);
  return c.length ? sql.join(c.map((x) => sql`(${x})`), sql` and `) : sql`true`;
}
