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
  /** Todos os números e e-mails do lead (com a pessoa de cada um) e como foram os contatos com o número procurado. */
  channels: { kind: "phone" | "email"; value: string; person: string | null; wrong: boolean }[];
  touch: { attempts: number; lastOutcome: string | null; lastAt: string; reached: number } | null;
  tasks: { id: number; title: string; dueAt: string | null }[];
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
      exists (select 1 from lead_channels c where c.lead_id = l.id and c.kind = 'phone' and right(regexp_replace(c.value, '\\D', '', 'g'), 8) = ${key})
      or exists (select 1 from unnest(l.phones) p where right(regexp_replace(p, '\\D', '', 'g'), 8) = ${key}))
    order by (case when ${ddd} <> '' and exists (select 1 from unnest(l.phones) p where regexp_replace(p, '\\D', '', 'g') like ${ddd + "%"}) then 0 else 1 end), l.times_served desc, l.id
    limit 5`);
  if (!rows.length) return [];
  const ids = rows.map((r) => Number(r.id));
  const data = await db.execute<Record<string, unknown>>(sql`
    select l.id, l.company, l.trade_name, l.city, l.uf, l.contact_name, l.role_title, l.email, l.kind, l.times_served, l.notes, l.eox_id, l.eox_code, l.sf_id, l.eox_info,
      (select p.name || '|' || coalesce(p.role_title, '') from lead_channels c join lead_people p on p.id = c.person_id where c.lead_id = l.id and c.kind = 'phone' and right(regexp_replace(c.value, '\\D', '', 'g'), 8) = ${key} limit 1) as person,
      (select name from users u where u.id = l.owner_id) as owner_name,
      (select d.stage from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido') limit 1) as deal_stage
    from leads l where l.id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const idList = sql.join(ids.map((i) => sql`${i}`), sql`, `);
  const chans = await db.execute<{ lead_id: number; kind: string; value: string; person: string | null; wrong: boolean }>(sql`
    select c.lead_id, c.kind, c.value, p.name as person, c.wrong from lead_channels c left join lead_people p on p.id = c.person_id where c.lead_id in (${idList}) order by c.kind desc, c.id`);
  const touches = await db.execute<{ lead_id: number; attempts: number; last_outcome: string | null; last_at: string; reached: number }>(sql`
    select lead_id, count(*)::int as attempts, (array_agg(outcome order by at desc))[1] as last_outcome, max(at) as last_at, count(*) filter (where outcome in ('atendeu','recado'))::int as reached
    from contact_events where lead_id in (${idList}) and channel = 'call' and right(target, 8) = ${key} group by lead_id`);
  const myTasks = await db.execute<{ id: number; lead_id: number; title: string; due_at: string | null }>(sql`
    select id, lead_id, title, due_at from tasks where user_id = ${me.id} and done_at is null and lead_id in (${idList}) order by due_at asc nulls last limit 20`);
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
      channels: chans.filter((c) => Number(c.lead_id) === id).map((c) => ({ kind: c.kind === "email" ? "email" as const : "phone" as const, value: c.value, person: c.person, wrong: !!c.wrong })),
      touch: (() => { const t = touches.find((x) => Number(x.lead_id) === id); return t ? { attempts: Number(t.attempts), lastOutcome: t.last_outcome, lastAt: new Date(t.last_at).toISOString(), reached: Number(t.reached) } : null; })(),
      tasks: myTasks.filter((t) => Number(t.lead_id) === id).map((t) => ({ id: Number(t.id), title: t.title, dueAt: t.due_at ? new Date(t.due_at).toISOString() : null })),
      person: (() => { const v = s("person"); if (!v) return null; const [name, role] = v.split("|"); return { name, role: role || null }; })(),
    }];
  });
}
