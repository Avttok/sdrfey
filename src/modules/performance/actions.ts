"use server";

import { requireUser } from "@/modules/auth/guard";
import { parseParams } from "./access";
import { buildReport, type Kind } from "./report";

export type Preview = { error?: string; summary?: { label: string; value: string; hint?: string }[]; sheets?: { id: string; name: string; total: number; cols: string[]; rows: (string | number | null)[][] }[] };

/** Prévia antes de baixar: indicadores + as primeiras linhas de cada aba. */
export async function previewAction(kind: Kind, raw: { from: string; to: string; sections: string[]; users: number[]; group: string }): Promise<Preview> {
  const me = await requireUser();
  const v = await parseParams(me, kind, raw);
  if ("error" in v) return { error: v.error };
  const r = await buildReport(v.params, v.names);
  const show = (x: string | number | null, fmt?: string) => (x == null ? "" : typeof x === "number" ? (fmt === "pct" ? `${(x * 100).toFixed(1)}%` : fmt === "brl" ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : x.toLocaleString("pt-BR")) : fmt === "datetime" ? new Date(x).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : fmt === "date" ? x.slice(0, 10).split("-").reverse().join("/") : x);
  return {
    summary: r.summary,
    sheets: r.sheets.map((s) => ({ id: s.id, name: s.name, total: s.rows.length, cols: s.cols.map((c) => c.header), rows: s.rows.slice(0, 6).map((row) => s.cols.map((c) => show(row[c.key] ?? null, c.fmt))) })),
  };
}
