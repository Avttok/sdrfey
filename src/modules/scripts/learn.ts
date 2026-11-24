"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db, scripts } from "@/db";
import { extractModule, moduleOf, entryOf } from "@/config/script-modules";
import { loadRuns, statsOf, type Run } from "./learn-core";
import type { ModuleStat } from "@/config/script-suggest";
import type { ScriptNode } from "@/config/scripts";
import { requireUser } from "@/modules/auth/guard";

let memo: { at: number; runs: Run[] } | null = null;

async function recentRuns(): Promise<Run[]> {
  if (memo && Date.now() - memo.at < 5 * 60_000) return memo.runs;
  const runs = await loadRuns();
  memo = { at: Date.now(), runs };
  return runs;
}

/** Dados para as sugestões da ligação: os números por módulo (da categoria do roteiro) e o que a galeria tem para o tipo de cliente. */
export async function suggestDataAction(goal: string, segment: string): Promise<{ stats: Record<string, ModuleStat>; gallery: string[] }> {
  await requireUser();
  const rows = await db.select({ nodes: scripts.nodes }).from(scripts).where(and(isNull(scripts.ownerId), eq(scripts.segment, segment), eq(scripts.active, true)));
  const keys = new Set<string>();
  for (const r of rows) for (const n of r.nodes as ScriptNode[]) { const k = moduleOf(n.id)?.key; if (k) keys.add(k); }
  return { stats: statsOf(await recentRuns(), goal), gallery: [...keys] };
}

/** Busca um módulo da galeria (de qualquer roteiro global do mesmo tipo de cliente) para encaixar na ligação. */
export async function loadModuleAction(key: string, segment: string, prefix: string): Promise<{ entry: string; nodes: ScriptNode[] } | null> {
  await requireUser();
  if (!/^g\d{1,3}:$/.test(prefix)) return null;
  const rows = await db.select({ nodes: scripts.nodes, goal: scripts.goal }).from(scripts).where(and(isNull(scripts.ownerId), eq(scripts.segment, segment), eq(scripts.active, true)));
  for (const r of rows) { const nodes = r.nodes as ScriptNode[]; if (entryOf(nodes, key)) { const x = extractModule(nodes, key, prefix); if (x) return x; } }
  return null;
}
