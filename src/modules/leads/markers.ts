import { sql, type SQL } from "drizzle-orm";
import { MARKERS, MARKER_BY_KEY } from "@/config/markers";

const filled = (col: string) => sql.raw(`coalesce(btrim(leads.${col}), '') <> ''`);
const phones = sql`exists (select 1 from lead_channels c where c.lead_id = leads.id and c.kind = 'phone' and not c.wrong)`;

/** Condição SQL de cada marcador (a tabela de leads precisa se chamar `leads`). */
const COND: Record<string, SQL> = {
  site: filled("site"),
  redes: sql`(${filled("instagram")} or ${filled("facebook")} or ${filled("linkedin")})`,
  instagram: filled("instagram"),
  facebook: filled("facebook"),
  linkedin: filled("linkedin"),
  celular: sql`exists (select 1 from lead_channels c where c.lead_id = leads.id and c.kind = 'phone' and not c.wrong and length(regexp_replace(c.value, '[^0-9]', '', 'g')) >= 11)`,
  telefone: phones,
  email: sql`exists (select 1 from lead_channels c where c.lead_id = leads.id and c.kind = 'email' and not c.wrong)`,
  contato: sql`(${filled("contact_name")} or exists (select 1 from lead_people p where p.lead_id = leads.id))`,
  endereco: sql`(${filled("address")} and ${filled("zip")})`,
  consultado: sql`leads.enriched_at is not null`,
  ativo: sql`leads.registration_status ilike 'ativ%'`,
  mei: sql`(leads.brasilapi_data->>'opcao_pelo_mei') = 'true'`,
  eox: sql`leads.eox_code is not null`,
  cliente: sql`exists (select 1 from deals d where d.lead_id = leads.id and d.stage = 'ganho')`,
  negociacao: sql`exists (select 1 from deals d where d.lead_id = leads.id and d.stage not in ('ganho','perdido'))`,
  visita: sql`exists (select 1 from visits v where v.lead_id = leads.id and v.canceled_at is null)`,
  atendido: sql`exists (select 1 from interactions i where i.lead_id = leads.id)`,
  novo: sql`leads.created_at > now() - interval '7 days'`,
};

export const markerCond = (key: string): SQL | null => (MARKER_BY_KEY.has(key) ? COND[key] ?? null : null);

/** Lista (text[]) dos marcadores que o lead tem, para mostrar as etiquetas. */
export const markerKeysExpr = (only?: readonly string[]): SQL =>
  sql`array_remove(array[${sql.join(MARKERS.filter((m) => !only || only.includes(m.key)).map((m) => sql`case when ${COND[m.key]} then ${m.key} end`), sql`, `)}], null)`;
