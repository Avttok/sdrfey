import { keyByTitle, moduleOf } from "@/config/script-modules";
import type { ModuleStat } from "@/config/script-suggest";

export type Run = { goal: string; outcome: string | null; finished: boolean; ids: string[]; taken: string[] };

/** Quanto cada módulo foi usado, terminou bem ou foi aceito como sugestão. Vale para os dados de todas as categorias, com preferência pela categoria pedida. */
export function statsOf(runs: Run[], goal: string | null): Record<string, ModuleStat> {
  const st: Record<string, ModuleStat> = {};
  for (const r of runs) {
    if (goal && r.goal !== goal) continue;
    const mods = new Set(r.ids.map((i) => moduleOf(i)?.key).filter((k): k is string => !!k));
    const win = r.finished && !!r.outcome && r.outcome !== "encerrar";
    for (const k of mods) { const s = (st[k] ??= { uses: 0, wins: 0, stops: 0, taken: 0 }); s.uses++; if (win) s.wins++; if (!r.finished) s.stops++; }
    for (const t of r.taken) { const k = keyByTitle(t.slice("Sugestão: ".length)); if (k) (st[k] ??= { uses: 0, wins: 0, stops: 0, taken: 0 }).taken++; }
  }
  return st;
}

/** Ligações guardadas (só os ids dos passos) para o painel e as sugestões. */
export async function loadRuns(limit = 6000): Promise<Run[]> {
  const { sql } = await import("drizzle-orm"); const { db } = await import("@/db");
  const rows = await db.execute<{ goal: string; outcome: string | null; finished: boolean; ids: string[]; via: (string | null)[] }>(sql`select c.goal, c.outcome, c.finished,
    array(select s->>'id' from jsonb_array_elements(c.steps) s) as ids, array(select s->>'answer' from jsonb_array_elements(c.steps) s) as via
    from call_scripts c where not c.is_test order by c.started_at desc limit ${limit}`);
  return [...rows].map((r) => ({ goal: r.goal, outcome: r.outcome, finished: r.finished, ids: r.ids ?? [], taken: (r.via ?? []).filter((x): x is string => !!x && x.startsWith("Sugestão: ")) }));
}
