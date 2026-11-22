import "server-only";
import { desc } from "drizzle-orm";
import { db, termSwaps } from "@/db";

export type SwapRow = { id: number; at: string; from: string; to: string; rows: number; undone: boolean };

/** Últimas trocas de termo no banco (para a tela do Glossário). */
export async function listSwaps(): Promise<SwapRow[]> {
  const rows = await db.select({ id: termSwaps.id, at: termSwaps.at, from: termSwaps.from, to: termSwaps.to, rows: termSwaps.rows, undoneAt: termSwaps.undoneAt }).from(termSwaps).orderBy(desc(termSwaps.at)).limit(15);
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), from: r.from, to: r.to, rows: r.rows, undone: !!r.undoneAt }));
}
