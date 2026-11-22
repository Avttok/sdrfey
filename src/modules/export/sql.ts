import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { EX_BY_KEY, type ExDatasetKey, type ExFilter, type ExNum, type ExRange } from "@/config/export-spec";

/**
 * SQL de cada exportação. As expressões são constantes escritas aqui (nunca vêm da tela); só os VALORES dos filtros viram parâmetros.
 * `expr` liga cada coluna da especificação (config/export-spec.ts) a uma expressão; `filter` liga cada filtro a uma condição.
 */
type Val = unknown;
type Def = { from: string; base: string[]; order: string; expr: Record<string, string>; filter: Record<string, (v: Val) => SQL | null> };

const TZ = "America/Sao_Paulo";
const list = (v: Val): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 300) : []);
const ints = (v: Val): number[] => list(v).map(Number).filter((n) => Number.isInteger(n));
const inList = (expr: string, vals: (string | number)[]) => (vals.length ? sql`${sql.raw(expr)} in (${sql.join(vals.map((x) => sql`${x}`), sql`, `)})` : null);
const text = (v: Val) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
const like = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
const ilike = (exprs: string[], s: string | null) => (s ? sql`(${sql.join(exprs.map((e) => sql`${sql.raw(e)} ilike ${like(s)}`), sql` or `)})` : null);
const tri = (v: Val, yes: string, no?: string): SQL | null => (v === "sim" ? sql.raw(yes) : v === "nao" ? sql.raw(no ?? `not (${yes})`) : null);
const isoDay = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
/** Intervalo de datas em horário de Brasília (para colunas com hora). */
const dt = (expr: string, v: Val): SQL | null => {
  const r = (v ?? {}) as ExRange, a = isoDay(r.from), b = isoDay(r.to);
  const e = sql.raw(`(${expr} at time zone '${TZ}')::date`);
  const parts = [a ? sql`${e} >= ${a}::date` : null, b ? sql`${e} <= ${b}::date` : null].filter(Boolean) as SQL[];
  return parts.length ? sql.join(parts, sql` and `) : null;
};
/** Intervalo de datas para colunas que já são só data. */
const dd = (expr: string, v: Val): SQL | null => {
  const r = (v ?? {}) as ExRange, a = isoDay(r.from), b = isoDay(r.to);
  const parts = [a ? sql`${sql.raw(expr)} >= ${a}::date` : null, b ? sql`${sql.raw(expr)} <= ${b}::date` : null].filter(Boolean) as SQL[];
  return parts.length ? sql.join(parts, sql` and `) : null;
};
const num = (expr: string, v: Val, scale = 1): SQL | null => {
  const r = (v ?? {}) as ExNum;
  const lo = typeof r.min === "number" && Number.isFinite(r.min) ? r.min * scale : null, hi = typeof r.max === "number" && Number.isFinite(r.max) ? r.max * scale : null;
  const parts = [lo !== null ? sql`${sql.raw(expr)} >= ${lo}` : null, hi !== null ? sql`${sql.raw(expr)} <= ${hi}` : null].filter(Boolean) as SQL[];
  return parts.length ? sql.join(parts, sql` and `) : null;
};
const digits = (s: string) => s.replace(/\D/g, "");

const tagList = (group: string) => `(select string_agg(t.label, ', ' order by t.sort) from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = '${group}')`;
const ch = (kind: "phone" | "email", main = false) => main
  ? `(select c.value from lead_channels c where c.lead_id = l.id and c.kind = '${kind}' and not c.wrong order by c.id limit 1)`
  : `(select string_agg(c.value, ', ' order by c.id) from lead_channels c where c.lead_id = l.id and c.kind = '${kind}' and not c.wrong)`;
const hasCh = (kind: string) => `exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = '${kind}' and not c.wrong)`;
const hasTag = (token: string) => sql`exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and (t.group_key || ':' || t.key) = ${token})`;
const arr = (col: string) => `case when jsonb_typeof(${col}) = 'array' then ${col} else '[]'::jsonb end`;

/** Colunas de contato do lead, reaproveitadas por negociações e visitas (o alias do lead é sempre `l`). */
const leadContact = { contact_name: "l.contact_name", phones: ch("phone"), emails: ch("email"), cnpj: "l.cnpj", company: "l.company", city: "l.city", uf: "l.uf" };
const STAGE = `case d.stage when 'novo' then 'Novo' when 'contato' then 'Em contato' when 'cotacao' then 'Cotação enviada' when 'negociacao' then 'Negociando' when 'ganho' then 'Faturado' when 'perdido' then 'Perdida' else d.stage end`;
const yn = (c: string) => `case when ${c} then 'SIM' else 'NÃO' end`;

export const DEFS: Record<ExDatasetKey, Def> = {
  leads: {
    from: "leads l", base: ["not l.is_test"], order: "l.id",
    expr: {
      cnpj: "l.cnpj", company: "l.company", trade_name: "coalesce(l.trade_name, l.brasilapi_data->>'nome_fantasia', l.receitaws_data->>'fantasia')", legal_name: "coalesce(l.brasilapi_data->>'razao_social', l.receitaws_data->>'nome')", sap_code: "l.sap_code",
      kind: "case l.kind when 'inativo' then 'Inativo (Vendas)' else 'Novo (Prospecção)' end", id: "l.id",
      contact_name: "l.contact_name", role_title: "l.role_title", phones: ch("phone"), phone_main: ch("phone", true), emails: ch("email"), email_main: ch("email", true),
      address: "l.address", neighborhood: "l.neighborhood", zip: "l.zip", city: "l.city", uf: "l.uf", state_reg: "l.state_reg",
      registration_status: "l.registration_status", cnae: "coalesce(l.brasilapi_data->>'cnae_fiscal_descricao', l.receitaws_data->'atividade_principal'->0->>'text')",
      capital_social: String.raw`(select case when v ~ '^[0-9]+(\.[0-9]+)?$' then v::numeric end from (select coalesce(l.brasilapi_data->>'capital_social', replace(l.receitaws_data->>'capital_social', ',', '.')) as v) q)`,
      opened_at: String.raw`case when l.brasilapi_data->>'data_inicio_atividade' ~ '^\d{4}-\d{2}-\d{2}$' then (l.brasilapi_data->>'data_inicio_atividade')::date when l.receitaws_data->>'abertura' ~ '^\d{2}/\d{2}/\d{4}$' then to_date(l.receitaws_data->>'abertura', 'DD/MM/YYYY') end`,
      partners: `coalesce((select string_agg(q->>'nome_socio', ', ') from jsonb_array_elements(${arr("l.brasilapi_data->'qsa'")}) q), (select string_agg(q->>'nome', ', ') from jsonb_array_elements(${arr("l.receitaws_data->'qsa'")}) q))`,
      site: "l.site", instagram: "l.instagram", facebook: "l.facebook", linkedin: "l.linkedin",
      tag_interest: tagList("temperatura"), tag_channel: tagList("meio"),
      qualified: `(case when exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = 'qualificacao' and t.key = 'qualificado') then 'SIM' when exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.group_key = 'qualificacao') then 'NÃO' else '' end)`,
      tag_situation: tagList("situacao"), tag_size: tagList("porte"), tag_capital: tagList("capital"),
      all_tags: "(select string_agg(t.label, ', ' order by t.group_key, t.sort) from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id)",
      owner: "(select o.name from users o where o.id = l.owner_id)", times_served: "l.times_served", times_worked: "l.times_worked",
      interactions: "(select count(*) from interactions i where i.lead_id = l.id and not i.is_test)::int", last_interaction: "(select max(i.at) from interactions i where i.lead_id = l.id and not i.is_test)",
      scheduled: yn("exists (select 1 from visits v where v.lead_id = l.id and v.canceled_at is null)"),
      visit_codes: "(select string_agg(v.code, ', ' order by v.created_at) from visits v where v.lead_id = l.id and v.canceled_at is null)",
      open_deal: yn("exists (select 1 from deals d where d.lead_id = l.id and not d.is_test and d.stage not in ('ganho','perdido'))"),
      deals_count: "(select count(*) from deals d where d.lead_id = l.id and not d.is_test)::int", notes: "l.notes",
      created_at: "l.created_at", updated_at: "l.updated_at", enriched_at: "l.enriched_at", source: "l.source",
    },
    filter: {
      kind: (v) => inList("l.kind", list(v)),
      search: (v) => { const s = text(v); return s ? sql`(${ilike(["l.company", "l.trade_name", "l.contact_name", "l.sap_code"], s)} or l.cnpj like ${"%" + (digits(s) || "§§") + "%"})` : null; },
      uf: (v) => inList("l.uf", list(v)), city: (v) => ilike(["l.city"], text(v)), cadStatus: (v) => inList("l.registration_status", list(v)),
      enriched: (v) => tri(v, "l.enriched_at is not null"), enrichedAt: (v) => dt("l.enriched_at", v),
      tags: (v) => { const t = list(v); return t.length ? sql`(${sql.join(t.map(hasTag), sql` or `)})` : null; },
      tagsAll: (v) => { const t = list(v); return t.length ? sql.join(t.map(hasTag), sql` and `) : null; },
      hasPhone: (v) => tri(v, hasCh("phone")), hasEmail: (v) => tri(v, hasCh("email")),
      hasContact: (v) => tri(v, "coalesce(trim(l.contact_name), '') <> ''"),
      hasSite: (v) => tri(v, "(coalesce(l.site,'') <> '' or coalesce(l.instagram,'') <> '' or coalesce(l.facebook,'') <> '' or coalesce(l.linkedin,'') <> '')"),
      owner: (v) => inList("l.owner_id", ints(v)),
      scheduled: (v) => tri(v, "exists (select 1 from visits v where v.lead_id = l.id and v.canceled_at is null)"),
      openDeal: (v) => tri(v, "exists (select 1 from deals d where d.lead_id = l.id and not d.is_test and d.stage not in ('ganho','perdido'))"),
      worked: (v) => tri(v, "l.times_worked > 0"), served: (v) => num("l.times_served", v),
      source: (v) => inList("l.source", list(v)), createdAt: (v) => dt("l.created_at", v), updatedAt: (v) => dt("l.updated_at", v),
    },
  },
  negociacoes: {
    from: "deals d join leads l on l.id = d.lead_id left join users sd on sd.id = d.sdr_id left join users sl on sl.id = d.seller_id", base: ["not d.is_test"], order: "d.id",
    expr: {
      ...leadContact, id: "d.id", stage: STAGE, sdr: "sd.name", seller: "sl.name", is_reactivation: yn("d.is_reactivation"), handoff_note: "d.handoff_note", lost_reason: "d.lost_reason",
      value: "d.value_cents / 100.0", closed_value: "d.closed_value_cents / 100.0", real_value: "d.real_value_cents / 100.0", net_value: "d.net_value_cents / 100.0", weight_kg: "d.weight_kg",
      quote_number: "d.quote_number", quote_date: "d.quote_date", order_number: "d.order_number", sap_code: "d.sap_code", freight: "d.freight", payment_terms: "d.payment_terms",
      created_at: "d.created_at", claimed_at: "d.claimed_at", last_contact_at: "d.last_contact_at", next_action_at: "d.next_action_at", next_action_note: "d.next_action_note", closed_on: "d.closed_on", closed_at: "d.closed_at",
    },
    filter: {
      stage: (v) => inList("d.stage", list(v)), open: (v) => tri(v, "d.stage not in ('ganho','perdido')"), seller: (v) => inList("d.seller_id", ints(v)), sdr: (v) => inList("d.sdr_id", ints(v)),
      noSeller: (v) => tri(v, "d.seller_id is not null"), uf: (v) => inList("l.uf", list(v)),
      search: (v) => { const s = text(v); return s ? sql`(${ilike(["l.company", "l.trade_name", "d.quote_number", "d.order_number", "d.sap_code"], s)} or l.cnpj like ${"%" + (digits(s) || "§§") + "%"})` : null; },
      reactivation: (v) => tri(v, "d.is_reactivation"), value: (v) => num("d.value_cents", v, 100),
      createdAt: (v) => dt("d.created_at", v), closedOn: (v) => dd("d.closed_on", v), quoteDate: (v) => dd("d.quote_date", v),
    },
  },
  visitas: {
    from: "visits v join leads l on l.id = v.lead_id left join users sd on sd.id = v.user_id left join users sl on sl.id = v.seller_id", base: ["not l.is_test"], order: "v.id",
    expr: {
      ...leadContact, code: "v.code", visit_date: "v.visit_date", status: "v.status", kind: "case v.kind when 'seller' then 'Vendedor' else 'Representante' end", canceled: yn("v.canceled_at is not null"), note: "v.note", link: "v.link",
      sdr: "sd.name", seller: "sl.name", rep_name: "v.rep_name", rep_sap: "v.rep_sap", rep_city: "v.rep_city", rep_km: "v.rep_km",
      created_at: "v.created_at", confirmed_at: "v.confirmed_at", canceled_at: "v.canceled_at",
    },
    filter: {
      status: (v) => inList("v.status", list(v)), kind: (v) => inList("v.kind", list(v)), canceled: (v) => tri(v, "v.canceled_at is not null"),
      sdr: (v) => inList("v.user_id", ints(v)), seller: (v) => inList("v.seller_id", ints(v)), uf: (v) => inList("l.uf", list(v)),
      search: (v) => { const s = text(v); return s ? sql`(${ilike(["l.company", "v.code", "v.rep_name", "v.rep_sap"], s)} or l.cnpj like ${"%" + (digits(s) || "§§") + "%"})` : null; },
      visitDate: (v) => dd("v.visit_date", v), createdAt: (v) => dt("v.created_at", v),
    },
  },
  interacoes: {
    from: "interactions i join leads l on l.id = i.lead_id left join users u on u.id = i.user_id", base: ["not i.is_test", "not l.is_test"], order: "i.at desc, i.id desc",
    expr: { at: "i.at", user: "u.name", channel: "i.channel", note: "i.note", cnpj: "l.cnpj", company: "l.company", city: "l.city", uf: "l.uf" },
    filter: {
      user: (v) => inList("i.user_id", ints(v)), channel: (v) => inList("i.channel", list(v)), hasNote: (v) => tri(v, "coalesce(trim(i.note), '') <> ''"), uf: (v) => inList("l.uf", list(v)),
      search: (v) => { const s = text(v); return s ? sql`(${ilike(["l.company", "i.note"], s)} or l.cnpj like ${"%" + (digits(s) || "§§") + "%"})` : null; }, at: (v) => dt("i.at", v),
    },
  },
  atendimentos: {
    from: "attendance_sessions s join leads l on l.id = s.lead_id left join users u on u.id = s.user_id", base: ["not s.is_test", "s.saved_at is not null"], order: "s.saved_at desc, s.id desc",
    expr: {
      user: "u.name", outcome: "s.outcome", shown_at: "s.shown_at", started_at: "s.started_at", saved_at: "s.saved_at",
      minutes: "round(extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at))) / 60.0, 1)", cnpj: "l.cnpj", company: "l.company", city: "l.city", uf: "l.uf",
    },
    filter: {
      user: (v) => inList("s.user_id", ints(v)), outcome: (v) => inList("s.outcome", list(v)), uf: (v) => inList("l.uf", list(v)),
      search: (v) => { const s = text(v); return s ? sql`(${ilike(["l.company"], s)} or l.cnpj like ${"%" + (digits(s) || "§§") + "%"})` : null; },
      savedAt: (v) => dt("s.saved_at", v), minutes: (v) => num("extract(epoch from (s.saved_at - coalesce(s.started_at, s.shown_at))) / 60.0", v),
    },
  },
  representantes: {
    from: "reps r", base: [], order: "r.id",
    expr: { rep_name: "r.rep_name", sap_code: "r.sap_code", cnpj: "r.cnpj", esc: "r.esc", manager_name: "r.manager_name", team: "r.team", address: "r.address", cep: "r.cep", city: "r.city", uf: "r.uf", active: "case when r.active then 'SIM' else 'NÃO' end" },
    filter: {
      uf: (v) => inList("r.uf", list(v)), city: (v) => ilike(["r.city"], text(v)), active: (v) => tri(v, "r.active"),
      search: (v) => ilike(["r.rep_name", "r.sap_code", "r.cnpj", "r.manager_name", "r.team"], text(v)),
    },
  },
  usuarios: {
    from: "users u", base: [], order: "u.id",
    expr: { username: "u.username", name: "u.name", roles: "array_to_string(u.roles, ', ')", active: "case when u.active then 'SIM' else 'NÃO' end", created_at: "u.created_at", daily_goal: "u.daily_goal", daily_goal_scheduled: "u.daily_goal_scheduled" },
    filter: { role: (v) => { const r = list(v); return r.length ? sql`u.roles && ${sql`array[${sql.join(r.map((x) => sql`${x}`), sql`, `)}]::text[]`}` : null; }, active: (v) => tri(v, "u.active") },
  },
  registro: {
    from: "audit_log a left join users u on u.id = a.user_id left join leads l on l.id = a.lead_id", base: [], order: "a.at desc, a.id desc",
    expr: { at: "a.at", who: "coalesce(u.name, 'Sistema')", entity: "a.entity", action: "a.action", field: "a.field", old_value: "a.old_value", new_value: "a.new_value", cnpj: "l.cnpj", company: "l.company" },
    filter: {
      user: (v) => inList("a.user_id", ints(v)), entity: (v) => inList("a.entity", list(v)), search: (v) => ilike(["a.action", "a.field", "a.old_value", "a.new_value"], text(v)), at: (v) => dt("a.at", v),
    },
  },
  consultas: {
    from: "enrich_log e join leads l on l.id = e.lead_id", base: [], order: "e.at desc, e.id desc",
    expr: { at: "e.at", origin: "e.origin", ok: "case when e.ok then 'SIM' else 'NÃO' end", ms: "e.ms", status: "e.status", phones: "e.phones", emails: "e.emails", why: "e.why", cnpj: "l.cnpj", company: "l.company" },
    filter: { origin: (v) => inList("e.origin", list(v)), ok: (v) => tri(v, "e.ok"), at: (v) => dt("e.at", v) },
  },
};

const ident = (k: string) => `"${k.replace(/[^a-z0-9_]/gi, "")}"`;

/** Condições (parte do WHERE) de um pedido: as fixas + as dos filtros preenchidos. */
export function conditions(key: ExDatasetKey, filters: Record<string, unknown>): { where: SQL; applied: { key: string; value: unknown }[] } {
  const d = DEFS[key];
  const parts: SQL[] = d.base.map((b) => sql.raw(b));
  const applied: { key: string; value: unknown }[] = [];
  for (const [k, fn] of Object.entries(d.filter)) {
    if (!(k in filters)) continue;
    const c = fn(filters[k]);
    if (c) { parts.push(sql`(${c})`); applied.push({ key: k, value: filters[k] }); }
  }
  return { where: parts.length ? sql.join(parts, sql` and `) : sql`true`, applied };
}

export function selectSql(key: ExDatasetKey, cols: string[], where: SQL, opts: { limit: number; offset?: number; sort?: { key: string; dir: "asc" | "desc" } | null }): SQL {
  const d = DEFS[key];
  const select = sql.join(cols.map((c) => sql`${sql.raw(d.expr[c])} as ${sql.raw(ident(c))}`), sql`, `);
  const sortExpr = opts.sort && d.expr[opts.sort.key] ? `${d.expr[opts.sort.key]} ${opts.sort.dir === "desc" ? "desc" : "asc"} nulls last, ${d.order}` : d.order;
  return sql`select ${select} from ${sql.raw(d.from)} where ${where} order by ${sql.raw(sortExpr)} limit ${opts.limit} offset ${opts.offset ?? 0}`;
}
export async function countRows(key: ExDatasetKey, where: SQL): Promise<number> {
  const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.raw(DEFS[key].from)} where ${where}`);
  return Number(r[0]?.n ?? 0);
}

/** Opções dos filtros que vêm do banco (UFs, pessoas, tags…). */
export async function loadOptions(dyn: NonNullable<ExFilter["dyn"]>): Promise<{ value: string; label: string }[]> {
  const rows = async (q: SQL) => [...(await db.execute<{ v: string | number | null; l: string | null }>(q))];
  const out = (r: { v: string | number | null; l: string | null }[]) => r.filter((x) => x.v !== null && x.v !== "").map((x) => ({ value: String(x.v), label: String(x.l ?? x.v) }));
  switch (dyn) {
    case "uf": return out(await rows(sql`select distinct uf as v, uf as l from leads where uf is not null and uf <> '' order by 1`));
    case "cadStatus": return out(await rows(sql`select distinct registration_status as v, registration_status as l from leads where registration_status is not null order by 1`));
    case "tags": return out(await rows(sql`select g.key || ':' || t.key as v, g.name || ' · ' || t.label as l from tags t join tag_groups g on g.key = t.group_key order by g.sort, g.name, t.sort, t.label`));
    case "users": return out(await rows(sql`select id as v, name as l from users order by name`));
    case "sellers": return out(await rows(sql`select id as v, name as l from users where 'seller' = any(roles) order by name`));
    case "channels": return out(await rows(sql`select distinct channel as v, channel as l from interactions order by 1`));
    case "outcomes": return out(await rows(sql`select distinct outcome as v, outcome as l from attendance_sessions where outcome is not null order by 1`));
    case "visitStatus": return out(await rows(sql`select distinct status as v, status as l from visits order by 1`));
    case "origins": return out(await rows(sql`select distinct origin as v, origin as l from enrich_log order by 1`));
    case "entities": return out(await rows(sql`select distinct entity as v, entity as l from audit_log order by 1`));
    case "sources": return out(await rows(sql`select distinct source as v, source as l from leads where source is not null and source <> '' order by 1 limit 200`));
  }
}
export const datasetOf = (k: string) => EX_BY_KEY.get(k as ExDatasetKey);
