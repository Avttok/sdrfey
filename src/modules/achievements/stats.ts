import { eq, sql } from "drizzle-orm";
import { achievementOverrides, db } from "@/db";
import { ACHIEVEMENTS, groupsFor, type Achievement } from "@/config/achievements";

export type Stats = Record<string, number>;
export type Earned = { key: string; earned: boolean; value: number; manual: "granted" | "blocked" | null };

const SP = sql.raw("'America/Sao_Paulo'");

/** Estatísticas de uma pessoa (testes não contam). Uma única consulta. */
export async function achievementStats(uid: number): Promise<Stats> {
  const [r] = await db.execute<Record<string, number | string | null>>(sql`
    with att as (select (saved_at at time zone ${SP}) l from attendance_sessions where user_id = ${uid} and outcome = 'saved' and not is_test and saved_at is not null),
    days as (select distinct l::date d from att),
    isl as (select count(*) n from (select d, d - (row_number() over (order by d))::int g from days) z group by g),
    sold as (select coalesce(real_value_cents, net_value_cents, closed_value_cents, value_cents, 0) c, lead_id, is_reactivation from deals where seller_id = ${uid} and not is_test and stage = 'ganho')
    select
      (select count(*) from att)::int as attended,
      (select count(*) from interactions where user_id = ${uid} and not is_test and channel = 'ligacao')::int as calls,
      (select count(*) from interactions where user_id = ${uid} and not is_test and channel = 'whatsapp')::int as whatsapps,
      (select count(*) from interactions where user_id = ${uid} and not is_test and channel = 'email')::int as emails,
      (select count(*) from visits where user_id = ${uid} and canceled_at is null)::int as visits,
      (select count(*) from deals where sdr_id = ${uid} and not is_test)::int as converted,
      (select coalesce(max(n), 0) from (select count(*) n from att group by l::date) z)::int as best_day,
      (select coalesce(max(n), 0) from isl)::int as streak,
      (select count(*) from days)::int as days_active,
      (select count(*) from att where extract(hour from l) < 8)::int as early,
      (select count(*) from att where extract(hour from l) >= 18)::int as late,
      greatest(0, (now()::date - (select created_at from users where id = ${uid})::date))::int as days_account,
      (select count(*) from deals where seller_id = ${uid} and not is_test)::int as deals_taken,
      (select count(*) from deal_quotes q join deals d on d.id = q.deal_id where q.created_by = ${uid} and not d.is_test)::int as quotes,
      (select count(*) from sold)::int as billed,
      (select coalesce(sum(c), 0) / 100.0 from sold)::float8 as billed_reais,
      (select coalesce(max(c), 0) / 100.0 from sold)::float8 as biggest_reais,
      (select count(distinct lead_id) from sold)::int as clients,
      (select count(*) from sold where is_reactivation)::int as reactivated,
      (select count(*) from seller_shuffles where user_id = ${uid} and not is_test and outcome in ('deal', 'no_answer', 'no_interest', 'skipped'))::int as shuffled,
      (select count(*) from seller_shuffles where user_id = ${uid} and not is_test and outcome = 'deal')::int as shuffle_deals,
      (select count(*) from coin_ledger where user_id = ${uid} and ref = 'egg:done')::int as egg`);
  return Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, Number(v ?? 0)]));
}

/** Resultado de cada conquista da pessoa: a estatística vale, a menos que o Adm tenha dado ou bloqueado na mão. */
export async function achievementsOf(uid: number, roles: readonly string[]): Promise<{ stats: Stats; list: (Achievement & Earned)[] }> {
  const [stats, over] = await Promise.all([achievementStats(uid), db.select().from(achievementOverrides).where(eq(achievementOverrides.userId, uid))]);
  const manual = new Map(over.map((o) => [o.key, o.granted]));
  const groups = groupsFor(roles);
  const list = ACHIEVEMENTS.filter((a) => groups.includes(a.group)).map((a) => {
    const m = manual.get(a.key);
    const value = stats[a.stat] ?? 0;
    return { ...a, value, manual: m === undefined ? null : m ? ("granted" as const) : ("blocked" as const), earned: m ?? value >= a.goal };
  }).filter((a) => !a.hidden || a.earned);
  return { stats, list };
}

/** Quem tem o Ovo de Ouro (achou o segredo, ou o Adm deu na mão e não bloqueou). Mostrado no perfil. */
export async function eggHolders(): Promise<number[]> {
  const rows = await db.execute<{ id: number }>(sql`
    select u.id from users u
    where (exists (select 1 from coin_ledger c where c.user_id = u.id and c.ref = 'egg:done') or exists (select 1 from achievement_overrides o where o.user_id = u.id and o.key = 'egg' and o.granted))
      and not exists (select 1 from achievement_overrides o where o.user_id = u.id and o.key = 'egg' and not o.granted)`);
  return rows.map((r) => Number(r.id));
}
