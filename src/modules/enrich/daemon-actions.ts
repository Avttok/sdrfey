"use server";

import { eq } from "drizzle-orm";
import { db, presence, settings, users } from "@/db";
import { DAEMON_KEY, DAEMON_OFFLINE_MIN, type DaemonState } from "@/config/enrich-daemon";
import { logAudit } from "@/modules/audit/log";
import { requireAdmin } from "@/modules/auth/guard";
import { AGE_LISTS } from "./ages";
import { enrichBatch, enrichStats, type EnrichStats } from "./batch";
import { recentRows, type LogRow } from "./live";

type Stored = { on: boolean; by: number | null; scope: number; since: string | null; stoppedWhy?: string | null };
export type DockData = { state: DaemonState; stats: EnrichStats; rows: LogRow[] };

async function read(): Promise<Stored> {
  const [r] = await db.select({ v: settings.value }).from(settings).where(eq(settings.key, DAEMON_KEY));
  const v = (r?.v ?? {}) as Partial<Stored>;
  return { on: !!v.on, by: typeof v.by === "number" ? v.by : null, scope: typeof v.scope === "number" ? v.scope : 0, since: v.since ?? null, stoppedWhy: v.stoppedWhy ?? null };
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
  return next;
}

async function toState(s: Stored, meId: number): Promise<DaemonState> {
  let byName: string | null = null;
  if (s.by != null) [{ n: byName } = { n: null }] = await db.select({ n: users.name }).from(users).where(eq(users.id, s.by));
  return { on: s.on, by: s.by, byName, mine: s.on && s.by === meId, scope: s.scope, since: s.since, stoppedWhy: s.on ? null : s.stoppedWhy ?? null };
}

/** Tudo que o painel lateral precisa, numa chamada só. */
export async function dockAction(): Promise<DockData> {
  const me = await requireAdmin();
  const s = await enforceOffline(await read(), me.id);
  const [state, stats, rows] = await Promise.all([toState(s, me.id), enrichStats(), recentRows(12)]);
  return { state, stats, rows };
}

export async function daemonStartAction(scope = 0): Promise<DockData> {
  const me = await requireAdmin();
  const sc = (AGE_LISTS as readonly number[]).includes(Number(scope)) ? Number(scope) : 0;
  await write({ on: true, by: me.id, scope: sc, since: new Date().toISOString(), stoppedWhy: null }, me.id);
  await logAudit(db, { userId: me.id, entity: "setting", action: "ligou a consulta contínua de CNPJ", field: "Consulta contínua", newValue: sc ? `consultados há mais de ${sc} dias` : "ainda não consultados" });
  return dockAction();
}

export async function daemonStopAction(): Promise<DockData> {
  const me = await requireAdmin();
  const s = await read();
  await write({ ...s, on: false, stoppedWhy: null }, me.id);
  await logAudit(db, { userId: me.id, entity: "setting", action: "desligou a consulta contínua de CNPJ", field: "Consulta contínua" });
  return dockAction();
}

/** Um passo: consulta 1 lead (só quem iniciou executa). Devolve também se deve continuar. */
export async function daemonTickAction(): Promise<DockData & { go: boolean }> {
  const me = await requireAdmin();
  const s = await enforceOffline(await read(), me.id);
  if (!s.on || s.by !== me.id) return { ...(await dockAction()), go: false };
  const r = await enrichBatch(1, 40_000, me.id, "lote", s.scope);
  const data = await dockAction();
  /* acabou a fila: desliga para não ficar rodando em vazio, e avisa no painel */
  if (r.tried === 0) { await write({ ...s, on: false, stoppedWhy: "Acabou: nada pendente nesta lista." }, me.id); return { ...(await dockAction()), go: false }; }
  return { ...data, go: data.state.on };
}
