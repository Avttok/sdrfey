import { and, desc, eq, sql } from "drizzle-orm";
import { attendanceSessions, db, leadSkips, leads, users } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { getSettings } from "@/modules/settings/get";
import type { ListFilters } from "@/config/lists";
import { listCondition } from "@/modules/lists/where";

/** Erro com mensagem pronta para mostrar ao usuário. */
export class UserError extends Error {}

/** Libera leads parados além do tempo limite (o atendimento fica marcado como "liberado"). */
export async function releaseExpiredLocks(): Promise<number> {
  const { lock_minutes } = await getSettings();
  const freed = await db.execute<{ id: number }>(sql`
    update leads set locked_by = null, locked_at = null
    where locked_by is not null and locked_at < now() - make_interval(mins => ${lock_minutes})
    returning id`);
  if (freed.length) {
    const ids = sql.join(freed.map((f) => sql`${f.id}`), sql`, `);
    await db.execute(sql`
      update attendance_sessions set outcome = 'released'
      where outcome is null and lead_id in (${ids})`);
  }
  return freed.length;
}

async function openSession(userId: number, leadId: number, isTest: boolean) {
  // fecha qualquer passagem anterior do mesmo usuário que ficou aberta
  await db
    .update(attendanceSessions)
    .set({ outcome: "abandoned" })
    .where(and(eq(attendanceSessions.userId, userId), sql`${attendanceSessions.outcome} is null`));
  const [s] = await db
    .insert(attendanceSessions)
    .values({ userId, leadId, isTest })
    .returning({ id: attendanceSessions.id });
  return s.id;
}

/**
 * Entrega o próximo lead aleatório para a pessoa. Se ela já tem um lead em mãos, devolve o mesmo.
 * O bloqueio é atômico (SKIP LOCKED): duas pessoas nunca recebem o mesmo lead.
 */
export async function claimNext(userId: number, opts: { test?: boolean; list?: ListFilters } = {}): Promise<number | null> {
  await releaseExpiredLocks();
  const [mine] = await db.select({ id: leads.id }).from(leads).where(eq(leads.lockedBy, userId)).limit(1);
  if (mine) return mine.id;

  const test = opts.test ?? false;
  const rows = await db.execute<{ id: number }>(sql`
    update leads set locked_by = ${userId}, locked_at = now(), last_served_at = now(), times_served = times_served + 1
    where id = (
      select l.id from leads l
      where l.locked_by is null
        and l.is_test = ${test}
        and l.kind = 'prospect'
        and (l.next_eligible_at is null or l.next_eligible_at <= now())
        and (l.return_at is null or l.return_at <= now())
        and (l.owner_id is null or l.owner_id = ${userId})
        and not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id
                        where lt.lead_id = l.id and t.blocks_sorting)
        and not exists (select 1 from deals dd where dd.lead_id = l.id)
        and not exists (select 1 from lead_skips s
                        where s.lead_id = l.id and s.user_id = ${userId} and s.until > now())
        and ${opts.list ? listCondition(opts.list) : sql`true`}
      order by (l.enriched_at is not null and not exists (select 1 from interactions i where i.lead_id = l.id)) desc, random() limit 1
      for update skip locked)
    returning id`);
  if (!rows[0]) return null;
  await openSession(userId, rows[0].id, test);
  return rows[0].id;
}

/** Existe algum lead que o sorteio poderia entregar agora a esta pessoa? (mesma regra do sorteio, sem reservar nada) */
export async function hasAvailable(userId: number, opts: { test?: boolean } = {}): Promise<boolean> {
  await releaseExpiredLocks();
  const rows = await db.execute<{ x: number }>(sql`
    select 1 as x from leads l
    where l.locked_by is null and l.is_test = ${opts.test ?? false} and l.kind = 'prospect'
      and (l.next_eligible_at is null or l.next_eligible_at <= now()) and (l.return_at is null or l.return_at <= now())
      and (l.owner_id is null or l.owner_id = ${userId})
      and not exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.blocks_sorting)
      and not exists (select 1 from deals dd where dd.lead_id = l.id)
      and not exists (select 1 from lead_skips s where s.lead_id = l.id and s.user_id = ${userId} and s.until > now())
    limit 1`);
  return rows.length > 0;
}

/** "ATENDER" em um lead específico (da aba Leads ou do histórico): mesmo fluxo do sorteio. */
export async function attendLead(userId: number, leadId: number): Promise<void> {
  await releaseExpiredLocks();
  const [inDeal] = await db.execute<{ x: number }>(sql`select 1 as x from deals where lead_id = ${leadId} limit 1`);
  if (inDeal) throw new UserError("Este cliente já está com os vendedores e não volta para o Shuffler.");
  const [inactive] = await db.execute<{ x: number }>(sql`select 1 as x from leads where id = ${leadId} and kind = 'inativo'`);
  if (inactive) throw new UserError("Lead inativo: quem trabalha é o vendedor, no Shuffler de vendas.");
  const rows = await db.execute<{ id: number; is_test: boolean }>(sql`
    update leads set locked_by = ${userId}, locked_at = now(), last_served_at = now(),
                     times_served = times_served + case when locked_by = ${userId} then 0 else 1 end
    where id = ${leadId} and (locked_by is null or locked_by = ${userId})
    returning id, is_test`);
  if (!rows[0]) {
    const [l] = await db
      .select({ by: users.name })
      .from(leads)
      .leftJoin(users, eq(users.id, leads.lockedBy))
      .where(eq(leads.id, leadId));
    if (!l) throw new UserError("Lead não encontrado.");
    throw new UserError(`Este lead está em atendimento por ${l.by ?? "outra pessoa"}.`);
  }
  // só depois de conseguir o novo, solta o lead anterior que a pessoa tinha em mãos
  await db.execute(sql`update leads set locked_by = null, locked_at = null
                       where locked_by = ${userId} and id <> ${leadId}`);
  const [open] = await db
    .select({ id: attendanceSessions.id })
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.userId, userId), eq(attendanceSessions.leadId, leadId), sql`${attendanceSessions.outcome} is null`))
    .limit(1);
  if (!open) await openSession(userId, leadId, rows[0].is_test);
  await logAudit(db, { userId, leadId, entity: "session", action: "começou a atender" });
}

/** Devolve o lead ao sorteio sem alterar nada. */
export async function releaseLead(userId: number, leadId: number): Promise<void> {
  await db.execute(sql`update leads set locked_by = null, locked_at = null where id = ${leadId} and locked_by = ${userId}`);
  await db
    .update(attendanceSessions)
    .set({ outcome: "released" })
    .where(and(eq(attendanceSessions.userId, userId), eq(attendanceSessions.leadId, leadId), sql`${attendanceSessions.outcome} is null`));
}

/** Pula o lead: ele some só para esta pessoa pelo tempo definido (padrão 24 h). Não conta na meta. */
export async function skipLead(userId: number, leadId: number): Promise<void> {
  const { skip_hours } = await getSettings();
  const until = new Date(Date.now() + skip_hours * 3600_000);
  await db
    .insert(leadSkips)
    .values({ leadId, userId, until })
    .onConflictDoUpdate({ target: [leadSkips.leadId, leadSkips.userId], set: { until } });
  await db.execute(sql`update leads set locked_by = null, locked_at = null where id = ${leadId} and locked_by = ${userId}`);
  await db
    .update(attendanceSessions)
    .set({ outcome: "skipped" })
    .where(and(eq(attendanceSessions.userId, userId), eq(attendanceSessions.leadId, leadId), sql`${attendanceSessions.outcome} is null`));
  await logAudit(db, { userId, leadId, entity: "session", action: "pulou o lead", meta: { ate: until.toISOString() } });
}

/** Marca atividade para a pessoa não perder o lead por inatividade enquanto atende. */
export async function touchLock(userId: number, leadId: number): Promise<void> {
  await db.execute(sql`update leads set locked_at = now() where id = ${leadId} and locked_by = ${userId}`);
}

/** Histórico da própria pessoa: leads que ela atendeu e salvou, do mais recente para o mais antigo. */
export async function userHistory(userId: number, limit = 200) {
  return db
    .select({
      sessionId: attendanceSessions.id,
      leadId: leads.id,
      company: leads.company,
      cnpj: leads.cnpj,
      city: leads.city,
      uf: leads.uf,
      savedAt: attendanceSessions.savedAt,
      outcome: attendanceSessions.outcome,
      seconds: sql<number | null>`extract(epoch from (${attendanceSessions.savedAt} - ${attendanceSessions.startedAt}))::int`,
    })
    .from(attendanceSessions)
    .innerJoin(leads, eq(leads.id, attendanceSessions.leadId))
    .where(and(eq(attendanceSessions.userId, userId), sql`${attendanceSessions.savedAt} is not null`, eq(attendanceSessions.isTest, false)))
    .orderBy(desc(attendanceSessions.savedAt))
    .limit(limit);
}
