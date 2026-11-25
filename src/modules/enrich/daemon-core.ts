import { eq, sql } from "drizzle-orm";
import { notify } from "@/modules/notifications/notify";
import { db, presence, settings, users } from "@/db";
import { DAEMON_KEY, DAEMON_OFFLINE_MIN, type DaemonState } from "@/config/enrich-daemon";
import { logAudit } from "@/modules/audit/log";
import { ENRICH_LIST_BY_KEY, normList } from "@/config/enrich-lists";
import { enrichBatch, enrichStats, type EnrichStats } from "./batch";
import { recentRows, type LogRow } from "./live";

/** Quantos leads cada passo do modo contínuo consulta (a Pesquisa Rápida faz vários ao mesmo tempo). */
export const CONTINUOUS_BATCH = 100;

type Stored = { on: boolean; by: number | null; scope: string; since: string | null; stoppedWhy?: string | null };
export type DockData = { state: DaemonState; stats: EnrichStats; rows: LogRow[]; /** ritmo dos últimos 10 min */ rate: { perMin: number; okPct: number | null; doneSince: number } };

async function read(): Promise<Stored> {
  const [r] = await db.select({ v: settings.value }).from(settings).where(eq(settings.key, DAEMON_KEY));
  const v = (r?.v ?? {}) as Partial<Stored>;
  return { on: !!v.on, by: typeof v.by === "number" ? v.by : null, scope: normList(v.scope), since: v.since ?? null, stoppedWhy: v.stoppedWhy ?? null };
}
async function write(v: Stored, by: number) {
  await db.insert(settings).values({ key: DAEMON_KEY, value: v, updatedBy: by }).onConflictDoUpdate({ target: settings.key, set: { value: v, updatedAt: new Date(), updatedBy: by } });
}

/** Quem começou ficou mais de 10 min sem dar sinal? Então a consulta para sozinha. */
async function enforceOffline(s: Stored, meId: number): Promise<Stored> {
  if (!s.on || s.by == null || s.by === meId) return s;
  const [p] = await db.select({ t: presence.lastSeenAt }).from(presence).where(eq(presence.userId, s.by));
  if (p && Date.now() - p.t.getTime() < DAEMON_OFFLINE_MIN * 60_000) return s;
  const next: Stored = { ...s, on: false, stoppedWhy: `Parou sozinha: quem iniciou ficou offline por mais de ${DAEMON_OFFLINE_MIN} minutos.` };
  await write(next, meId);
  await logAudit(db, { userId: meId, entity: "setting", action: "consulta contínua de CNPJ parou (iniciador offline)" });
  await notify(s.by, { kind: "consulta", title: "A consulta de CNPJ parou", body: next.stoppedWhy, href: "/admin/consulta-cnpj" });
  return next;
}

async function toState(s: Stored, meId: number): Promise<DaemonState> {
  let byName: string | null = null;
  if (s.by != null) [{ n: byName } = { n: null }] = await db.select({ n: users.name }).from(users).where(eq(users.id, s.by));
  return { on: s.on, by: s.by, byName, mine: s.on && s.by === meId, scope: s.scope, since: s.since, stoppedWhy: s.on ? null : s.stoppedWhy ?? null };
}

/** Tudo que o painel lateral precisa, numa chamada só. */
export async function dockCore(me: { id: number }): Promise<DockData> {
  const s = await enforceOffline(await read(), me.id);
  const [state, stats, rows, [rt]] = await Promise.all([toState(s, me.id), enrichStats(), recentRows(12), db.execute<{ n: number; ok: number; since: number }>(sql`
    select count(*)::int as n, count(*) filter (where ok)::int as ok, (select count(*)::int from enrich_log where at >= ${s.since ?? "1970-01-01"}::timestamptz) as since from enrich_log where at > now() - interval '10 minutes'`)]);
  return { state, stats, rows, rate: { perMin: Math.round(((rt?.n ?? 0) / 10) * 10) / 10, okPct: rt?.n ? Math.round(((rt.ok ?? 0) / rt.n) * 100) : null, doneSince: s.on ? rt?.since ?? 0 : 0 } };
}

export async function startCore(me: { id: number }, scope: number | string = "new"): Promise<DockData> {
  const sc = normList(scope);
  await write({ on: true, by: me.id, scope: sc, since: new Date().toISOString(), stoppedWhy: null }, me.id);
  await logAudit(db, { userId: me.id, entity: "setting", action: "ligou a consulta contínua de CNPJ", field: "Consulta contínua", newValue: ENRICH_LIST_BY_KEY.get(sc)?.label ?? sc });
  return dockCore(me);
}

export async function stopCore(me: { id: number }): Promise<DockData> {
  const s = await read();
  await write({ ...s, on: false, stoppedWhy: null }, me.id);
  await logAudit(db, { userId: me.id, entity: "setting", action: "desligou a consulta contínua de CNPJ", field: "Consulta contínua" });
  return dockCore(me);
}

/** Um passo: consulta um bloco de 100 leads (só quem iniciou executa). Devolve também se deve continuar. */
export async function tickCore(me: { id: number }): Promise<DockData & { go: boolean }> {
  const s = await enforceOffline(await read(), me.id);
  if (!s.on || s.by !== me.id) return { ...(await dockCore(me)), go: false };
  const r = await enrichBatch(CONTINUOUS_BATCH, 42_000, me.id, "lote", s.scope);
  const data = await dockCore(me);
  /* acabou a fila: desliga para não ficar rodando em vazio, e avisa no painel */
  if (r.tried === 0) { await write({ ...s, on: false, stoppedWhy: "Acabou: nada pendente nesta lista." }, me.id); return { ...(await dockCore(me)), go: false }; }
  return { ...data, go: data.state.on };
}
