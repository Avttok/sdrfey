"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";
import { eoxBaseUrl, eoxProfileUrl } from "@/modules/eox/sync";

/** O que o telefone mostra sobre o lead dono do número. */
export type PhoneLead = {
  id: number; company: string; tradeName: string | null; city: string | null; uf: string | null;
  contactName: string | null; roleTitle: string | null; email: string | null; kind: "prospect" | "inativo";
  ownerName: string | null; timesServed: number; dealStage: string | null; notes: string | null;
  eoxId: string | null; eoxCode: string | null; sfId: string | null; eoxUrl: string | null; eoxInfo: Record<string, string> | null; person: { name: string; role: string | null } | null;
};

/** Últimos 8 dígitos do número (ignora país, DDD e o nono dígito): é a chave para reconhecer o lead. */
const phoneKey = (v: string) => v.replace(/\D/g, "").slice(-8);

/**
 * Reconhece o lead pelo telefone, em qualquer um dos números cadastrados (principal e canais).
 * Devolve até 5 leads, o que tem o mesmo DDD primeiro. Só para quem pode ver leads.
 */
export async function lookupPhoneAction(raw: string): Promise<PhoneLead[]> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || (!me.isAdmin && !me.permissions["tab.leads"])) return [];
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return [];
  const key = phoneKey(digits);
  const nat = digits.replace(/^55(?=\d{10,11}$)/, "");
  const ddd = nat.length >= 10 ? nat.slice(0, 2) : "";
  const rows = await db.execute<{ id: number }>(sql`
    select l.id from leads l
    where l.is_test = false and (
      exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and right(regexp_replace(c.value, '\D', '', 'g'), 8) = ${key})
      or exists (select 1 from unnest(l.phones) p where right(regexp_replace(p, '\D', '', 'g'), 8) = ${key}))
    order by (case when ${ddd} <> '' and exists (select 1 from unnest(l.phones) p where regexp_replace(p, '\D', '', 'g') like ${ddd + "%"}) then 0 else 1 end), l.times_served desc, l.id
    limit 5`);
  if (!rows.length) return [];
  const ids = rows.map((r) => Number(r.id));
  const data = await db.execute<Record<string, unknown>>(sql`
    select l.id, l.company, l.trade_name, l.city, l.uf, l.contact_name, l.role_title, l.email, l.kind, l.times_served, l.notes, l.eox_id, l.eox_code, l.sf_id, l.eox_info,
      (select p.name || '|' || coalesce(p.role_title, '') from lead_channels c join lead_people p on p.id = c.person_id where c.lead_id = l.id and c.kind = 'phone' and right(regexp_replace(c.value, '\D', '', 'g'), 8) = ${key} limit 1) as person,
      (select name from users u where u.id = l.owner_id) as owner_name,
      (select d.stage from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido') limit 1) as deal_stage
    from leads l where l.id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const base = await eoxBaseUrl();
  const by = new Map(data.map((r) => [Number(r.id), r]));
  return ids.flatMap((id) => {
    const r = by.get(id);
    if (!r) return [];
    const s = (k: string) => (r[k] == null ? null : String(r[k]));
    const notes = s("notes");
    return [{
      id, company: String(r.company), tradeName: s("trade_name"), city: s("city"), uf: s("uf"), contactName: s("contact_name"), roleTitle: s("role_title"), email: s("email"),
      kind: r.kind === "inativo" ? "inativo" as const : "prospect" as const, ownerName: s("owner_name"), timesServed: Number(r.times_served ?? 0), dealStage: s("deal_stage"),
      notes: notes ? notes.slice(0, 220) : null, eoxId: s("eox_id"), eoxCode: s("eox_code"), sfId: s("sf_id"), eoxUrl: eoxProfileUrl(base, s("eox_id")),
      eoxInfo: (r.eox_info as Record<string, string> | null) ?? null,
      person: (() => { const v = s("person"); if (!v) return null; const [name, role] = v.split("|"); return { name, role: role || null }; })(),
    }];
  });
}
