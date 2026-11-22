import { z } from "zod";
import type { ScriptNode } from "@/config/scripts";
import { SEGMENTS } from "@/config/scripts";

const text = (max: number) => z.string().trim().max(max);
export const nodeSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9_-]{1,24}$/i, "Código de passo inválido."),
  type: z.enum(["fala", "fim"]),
  title: text(60).min(1, "Todo passo precisa de um nome."),
  say: text(1500),
  tip: text(400).optional(),
  options: z.array(z.object({ label: text(120).min(1, "Toda resposta precisa de um texto."), to: z.string().trim().max(24).nullable(), kind: z.enum(["ok", "objecao", "neutro"]) })).max(10),
  outcome: z.enum(["visita", "cotacao", "retorno", "venda", "encerrar"]).optional(),
});

export const scriptInput = z.object({
  id: z.number().int().optional(),
  title: text(80).min(2, "Dê um nome ao script."),
  segment: z.string().refine((s) => s in SEGMENTS, "Escolha o tipo de estabelecimento."),
  goal: z.enum(["sdr", "vendas", "retorno"]),
  summary: text(300).nullish(),
  startId: z.string(),
  nodes: z.array(nodeSchema).min(1, "O script precisa de pelo menos um passo.").max(60, "No máximo 60 passos."),
  global: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Confere a árvore: ids únicos, início existente, e toda resposta aponta para um passo que existe. Devolve o erro ou null. */
export function checkTree(nodes: ScriptNode[], startId: string): string | null {
  const ids = new Set<string>();
  for (const n of nodes) { if (ids.has(n.id)) return `Passo repetido (${n.id}).`; ids.add(n.id); }
  if (!ids.has(startId)) return "Escolha o passo em que o script começa.";
  for (const n of nodes) for (const o of n.options) if (o.to && !ids.has(o.to)) return `Uma resposta do passo "${n.title}" aponta para um passo que não existe.`;
  return null;
}

/** Passos que ninguém alcança a partir do início (aviso no editor). */
export function unreachable(nodes: ScriptNode[], startId: string): string[] {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const walk = (id: string) => { if (seen.has(id) || !by.has(id)) return; seen.add(id); for (const o of by.get(id)!.options) if (o.to) walk(o.to); };
  walk(startId);
  return nodes.filter((n) => !seen.has(n.id)).map((n) => n.title);
}
