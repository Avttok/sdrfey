import { leftPortfolio } from "@/modules/deals/portfolio";
import type { Role } from "@/config/roles";
import { and, desc, sql, type SQL } from "drizzle-orm";
import { db, leads } from "@/db";
import { dayEnd, dayStart } from "@/lib/format";

export type LeadFilters = {
  q?: string;
  /** "grupo:chave" — dentro do mesmo grupo vale "ou"; entre grupos vale "e". */
  tags: string[];
  owner?: string; // id ou "-" (sem responsável)
  uf?: string;
  city?: string;
  phone?: "1" | "0";
  email?: "1" | "0";
  status?: string; // situação cadastral
  from?: string; // AAAA-MM-DD
  to?: string;
  visit?: string;
  /** Vendedor: só os leads com negociação dele ou ainda sem vendedor. */
  sellerScope?: number;
  /** Atalho de situação: livres para sorteio, em atendimento agora ou com os vendedores. */
  show?: "livres" | "atendimento" | "vendedores";
  sort?: "nome" | "novos";
  /** Tipo do lead: novo (Prospecção) ou já cliente da Fey (Inativo). */
  tipo?: "prospect" | "inativo";
  /** Lote de importação que criou o lead. */
  lote?: number;
  /** Tem (1) ou não tem (0) Código EOX válido. */
  eox?: "1" | "0";
  /** Consulta de CNPJ feita (1) ou não (0). */
  cnpj?: "1" | "0";
  /** Já foi atendido alguma vez (1) ou nunca (0). */
  servido?: "1" | "0";
  /** Tem retorno combinado (1) ou não (0). */
  retorno?: "1" | "0";
  page: number;
};

export const PAGE_SIZE = 50;

export function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() || undefined : undefined);
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : []);
  const flag = (k: string) => (one(k) === "1" ? "1" : one(k) === "0" ? "0" : undefined);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  return {
    q: one("q"), tags: many("tag").filter((t) => /^[\w]+:[\w-]+$/.test(t)), owner: one("owner"), uf: one("uf")?.toUpperCase(), city: one("city"),
    phone: flag("phone"), email: flag("email"), status: one("status"), from: date("from"), to: date("to"), visit: one("visit"),
    show: (["livres", "atendimento", "vendedores"] as const).find((x) => x === one("show")),
    sort: (["nome", "novos"] as const).find((x) => x === one("sort")),
    tipo: (["prospect", "inativo"] as const).find((x) => x === one("tipo")),
    lote: /^\d+$/.test(one("lote") ?? "") ? Number(one("lote")) : undefined,
    eox: flag("eox"), cnpj: flag("cnpj"), servido: flag("servido"), retorno: flag("retorno"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

function where(f: LeadFilters): SQL | undefined {
  const c: SQL[] = [sql`${leads.isTest} = false`];
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    const id = f.q.trim();
    const idLike = `${id.replace(/[%_]/g, "")}%`;
    c.push(sql`(${leads.company} ilike ${like} or ${leads.eoxId} = ${id} or ${leads.eoxCode} = ${id} or ${leads.sapCode} = ${id} or ${leads.sfId} ilike ${idLike} or ${leads.tradeName} ilike ${like} or exists (select 1 from lead_people p where p.lead_id = ${leads.id} and p.name ilike ${like})
      ${digits.length >= 3 ? sql`or ${leads.cnpj} like ${`%${digits}%`} or exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.value like ${`%${digits}%`})` : sql``}
      or exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'email' and c.value ilike ${like}))`);
  }
  const byGroup = new Map<string, string[]>();
  for (const t of f.tags) {
    const [g, k] = t.split(":");
    byGroup.set(g, [...(byGroup.get(g) ?? []), k]);
  }
  for (const [g, keys] of byGroup) {
    c.push(sql`exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = ${leads.id} and t.group_key = ${g} and t.key in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)}))`);
  }
  const openDeal = sql`exists (select 1 from deals d where d.lead_id = ${leads.id} and d.stage not in ('ganho','perdido'))`;
  if (f.show === "livres") c.push(sql`${leads.lockedBy} is null and ${leads.ownerId} is null and not ${openDeal}`);
  if (f.show === "atendimento") c.push(sql`${leads.lockedBy} is not null`);
  if (f.show === "vendedores") c.push(openDeal);
  if (f.tipo) c.push(sql`${leads.kind} = ${f.tipo}`);
  if (f.lote) c.push(sql`${leads.importBatchId} = ${f.lote}`);
  if (f.eox) c.push(f.eox === "1" ? sql`${leads.eoxId} ~ '^\\d{7,}$'` : sql`(${leads.eoxId} is null or ${leads.eoxId} !~ '^\\d{7,}$')`);
  if (f.cnpj) c.push(f.cnpj === "1" ? sql`${leads.enrichedAt} is not null` : sql`${leads.enrichedAt} is null`);
  if (f.servido) c.push(f.servido === "1" ? sql`${leads.timesServed} > 0` : sql`${leads.timesServed} = 0`);
  if (f.retorno) c.push(f.retorno === "1" ? sql`${leads.returnAt} is not null` : sql`${leads.returnAt} is null`);
  if (f.owner === "-") c.push(sql`${leads.ownerId} is null`);
  else if (f.owner && /^\d+$/.test(f.owner)) c.push(sql`${leads.ownerId} = ${Number(f.owner)}`);
  if (f.uf) c.push(sql`${leads.uf} = ${f.uf}`);
  if (f.city) c.push(sql`${leads.city} ilike ${`%${f.city}%`}`);
  if (f.status) c.push(sql`${leads.registrationStatus} ilike ${f.status}`);
  if (f.phone) c.push(f.phone === "1" ? sql`exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'phone' and not c.wrong)` : sql`not exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'phone' and not c.wrong)`);
  if (f.email) c.push(f.email === "1" ? sql`exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'email' and not c.wrong)` : sql`not exists (select 1 from lead_channels c where c.lead_id = ${leads.id} and c.kind = 'email' and not c.wrong)`);
  if (f.from) c.push(sql`${leads.updatedAt} >= ${dayStart(f.from).toISOString()}::timestamptz`);
  if (f.to) c.push(sql`${leads.updatedAt} <= ${dayEnd(f.to).toISOString()}::timestamptz`);
  if (f.visit) c.push(sql`exists (select 1 from visits v where v.lead_id = ${leads.id} and v.code ilike ${`%${f.visit}%`})`);
  if (f.sellerScope) c.push(sql`exists (select 1 from deals d where d.lead_id = ${leads.id} and (d.seller_id = ${f.sellerScope} or d.seller_id is null)) and not ${leftPortfolio(sql`${leads.id}`)}`);
  return and(...c);
}

export async function listLeads(f: LeadFilters) {
  const w = where(f);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(w);
  const rows = await db.execute<{ deal_stage: string | null; deal_id: number | null; status: string | null; phones: number; emails: number; updated_at: string; id: number; company: string; trade_name: string | null; cnpj: string; city: string | null; uf: string | null; owner_name: string | null; owner_accent: string | null; owner_id: number | null; owner_roles: Role[] | null; seller_name: string | null; seller_accent: string | null; seller_id: number | null; seller_roles: Role[] | null; locked_roles: Role[] | null; locked_by_name: string | null; locked_by_accent: string | null; locked_by_id: number | null; tags: { label: string; color: string; group: string }[] }>(sql`
    select (select d.stage from deals d where d.lead_id = leads.id order by d.created_at desc limit 1) as deal_stage, (select d.id from deals d where d.lead_id = leads.id order by d.created_at desc limit 1) as deal_id, leads.registration_status as status, leads.updated_at, (select count(*)::int from lead_channels c where c.lead_id = leads.id and c.kind = 'phone' and not c.wrong) as phones, (select count(*)::int from lead_channels c where c.lead_id = leads.id and c.kind = 'email' and not c.wrong) as emails, leads.id, leads.company, leads.trade_name, leads.cnpj, leads.city, leads.uf, o.name as owner_name, o.accent as owner_accent, leads.owner_id as owner_id, o.roles as owner_roles, lk.roles as locked_roles, lk.name as locked_by_name, lk.accent as locked_by_accent, lk.id as locked_by_id, ds.name as seller_name, ds.accent as seller_accent, ds.id as seller_id, ds.roles as seller_roles,
      coalesce((select json_agg(json_build_object('label', t.label, 'color', t.color, 'group', t.group_key) order by g.sort, t.sort, t.label)
                from lead_tags lt join tags t on t.id = lt.tag_id join tag_groups g on g.key = t.group_key where lt.lead_id = leads.id and t.active), '[]'::json) as tags
    from leads left join users o on o.id = leads.owner_id left join users lk on lk.id = leads.locked_by left join lateral (select su.id, su.name, su.accent, su.roles from deals d join users su on su.id = d.seller_id where d.lead_id = leads.id order by d.created_at desc limit 1) ds on true
    where ${w ?? sql`true`}
    order by ${f.sort === "nome" ? sql`lower(leads.company) asc, leads.id` : f.sort === "novos" ? sql`leads.created_at desc, leads.id desc` : sql`1 = 1`},
      exists (select 1 from lead_tags lt join tags tg on tg.id = lt.tag_id where lt.lead_id = leads.id and tg.group_key = 'qualificacao' and tg.key = 'desqualificado'),
      (leads.enriched_at is null),
      (coalesce(leads.registration_status, '') not ilike 'ativ%'),
      (leads.locked_by is not null or leads.owner_id is not null),
      leads.updated_at desc, leads.id desc
    limit ${PAGE_SIZE} offset ${(f.page - 1) * PAGE_SIZE}`);
  return { total: n, rows: [...rows], pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}
void desc;
