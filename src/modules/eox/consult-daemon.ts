import { eq, sql } from "drizzle-orm";
import { db, presence, settings, users } from "@/db";
import { EOX_DAEMON_KEY, normEoxList, EOX_LIST_BY_KEY, type EoxDaemonState } from "@/config/eox-lists";
import { DAEMON_OFFLINE_MIN } from "@/config/enrich-daemon";
import { logAudit } from "@/modules/audit/log";
import { notify } from "@/modules/notifications/notify";
import { eoxBatch, eoxStats, type EoxStats } from "./consult-batch";

type Stored = { on: boolean; by: number | null; scope: string; since: string | null; stoppedWhy?: string | null };
export type EoxLogRow = { id: number; leadId: number; company: string; at: string; ok: boolean; ms: number; by: string | null; phones: number; emails: number; people: number; filled: number; why: string | null; origin: string };
export type EoxDock = { state: EoxDaemonState; stats: EoxStats; rows: EoxLogRow[]; rate: { perMin: number; okPct: number | null; doneSince: number } };

async function read(): Promise<Stored> {
  const [r] = await db.select({ v: settings.value }).from(settings).where(eq(settings.key, EOX_DAEMON_KEY));
  const v = (r?.v ?? {}) as Partial<Stored>;
  return { on: !!v.on, by: typeof v.by === "number" ? v.by : null, scope: normEoxList(v.scope), since: v.since ?? null, stoppedWhy: v.stoppedWhy ?? null };
}
async function write(v: Stored, by: number) {
  await db.insert(settings).values({ key: EOX_DAEMON_KEY, value: v, updatedBy: by }).onConflictDoUpdate({ target: settings.key, set: { value: v, updatedAt: new Date(), updatedBy: by } });
}
/** Roda sem parar até o Adm cancelar. Se quem iniciou saiu (ficou offline), o próximo Adm com o painel aberto assume o laço. */
async function starterGone(s: Stored): Promise<boolean> {
  if (s.by == null) return true;
  const [p] = await db.select({ t: presence.lastSeenAt }).from(presence).where(eq(presence.userId, s.by));
  return !p || Date.now() - p.t.getTime() >= DAEMON_OFFLINE_MIN * 60_000;
}
async function enforceOffline(s: Stored, _meId: number): Promise<Stored> { return s; }
async function toState(s: Stored, meId: number): Promise<EoxDaemonState> {
  const gone = s.on && s.by !== meId && (await starterGone(s));
  let byName: string | null = null;
  if (s.by != null) [{ n: byName } = { n: null }] = await db.select({ n: users.name }).from(users).where(eq(users.id, s.by));
  return { on: s.on, by: s.by, byName, mine: s.on && (s.by === meId || gone), scope: s.scope, since: s.since, stoppedWhy: s.on ? null : s.stoppedWhy ?? null };
}
const iso = (d: unknown) => new Date(d as string).toISOString();

export async function eoxDock(me: { id: number }): Promise<EoxDock> {
  const s = await enforceOffline(await read(), me.id);
  const [state, stats, rows, [rt]] = await Promise.all([
    toState(s, me.id), eoxStats(),
    db.execute<Record<string, unknown>>(sql`select g.id, g.lead_id, l.company, g.at, g.ok, g.ms, u.name as by, g.phones, g.emails, g.people, g.filled, g.why, g.origin
      from eox_log g join leads l on l.id = g.lead_id left join users u on u.id = g.user_id order by g.id desc limit 12`),
    db.execute<{ n: number; ok: number; since: number }>(sql`select count(*)::int as n, count(*) filter (where ok)::int as ok,
      (select count(*)::int from eox_log where at >= ${s.since ?? "1970-01-01"}::timestamptz) as since from eox_log where at > now() - interval '10 minutes'`),
  ]);
  return {
    state, stats, rate: { perMin: Math.round(((rt?.n ?? 0) / 10) * 10) / 10, okPct: rt?.n ? Math.round(((rt.ok ?? 0) / rt.n) * 100) : null, doneSince: s.on ? rt?.since ?? 0 : 0 },
    rows: [...rows].map((r) => ({ id: Number(r.id), leadId: Number(r.lead_id), company: String(r.company), at: iso(r.at), ok: !!r.ok, ms: Number(r.ms), by: (r.by as string | null) ?? null, phones: Number(r.phones), emails: Number(r.emails), people: Number(r.people), filled: Number(r.filled), why: (r.why as string | null) ?? null, origin: String(r.origin) })),
  };
}
export async function eoxStart(me: { id: number }, scope: string = "new"): Promise<EoxDock> {
  const sc = normEoxList(scope);
  // reconsulta geral: tira da "geladeira" (7 dias) os leads que a EOX não achou numa rodada antiga, p.ex. com o campo do CNPJ errado
  if (sc === "refresh" || sc === "no_link") await db.execute(sql`update leads set eox_tried_at = null where eox_tried_at is not null and eox_checked_at is null`);
  await write({ on: true, by: me.id, scope: sc, since: new Date().toISOString(), stoppedWhy: null }, me.id);
  await logAudit(db, { userId: me.id, entity: "setting", action: "ligou a consulta contínua da EOX", field: "Consulta EOX", newValue: EOX_LIST_BY_KEY.get(sc)?.label ?? sc });
  return eoxDock(me);
}
export async function eoxStop(me: { id: number }): Promise<EoxDock> {
  const s = await read();
  await write({ ...s, on: false, stoppedWhy: null }, me.id);
  await logAudit(db, { userId: me.id, entity: "setting", action: "desligou a consulta contínua da EOX", field: "Consulta EOX" });
  return eoxDock(me);
}
/** Um passo: consulta um bloco. Não para sozinho: fila vazia ou EOX recusando só faz esperar e tentar de novo. */
export async function eoxTick(me: { id: number }): Promise<EoxDock & { go: boolean; wait: number }> {
  const s = await read();
  if (!s.on) return { ...(await eoxDock(me)), go: false, wait: 0 };
  if (s.by !== me.id) {
    if (!(await starterGone(s))) return { ...(await eoxDock(me)), go: false, wait: 0 };
    await write({ ...s, by: me.id }, me.id); // assume o laço de quem saiu
  }
  const r = await eoxBatch(null, 42_000, me.id, s.scope);
  const data = await eoxDock(me);
  if (r.tried === 0) return { ...data, go: true, wait: 30 }; // fila vazia: fica de olho (leads novos entram sozinhos)
  if (r.ok === 0 && r.tried >= 10) return { ...data, go: true, wait: 60 }; // EOX recusando: espera e tenta de novo
  return { ...data, go: true, wait: 2 };
}
