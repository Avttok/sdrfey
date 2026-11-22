"use server";
import { requirePerm } from "@/modules/auth/guard";
import { canExport } from "./access";
import { cleanRequest, previewOf } from "./run";
import { loadOptions } from "./sql";
import { type ExFilter } from "@/config/export-spec";

const DYN = new Set<string>(["uf", "cadStatus", "tags", "users", "sellers", "channels", "outcomes", "visitStatus", "origins", "entities", "sources"]);

/** Opções dos filtros que vêm do banco (UFs, pessoas, tags…) das bases que a pessoa pode ver. */
export async function exportOptionsAction(dyns: string[]): Promise<Record<string, { value: string; label: string }[]>> {
  await requirePerm("tab.exportar");
  const out: Record<string, { value: string; label: string }[]> = {};
  for (const d of [...new Set(dyns)].filter((x) => DYN.has(x))) out[d] = await loadOptions(d as NonNullable<ExFilter["dyn"]>);
  return out;
}

/** Quantas linhas o pedido gera e uma amostra para conferir antes de baixar. */
export async function exportPreviewAction(raw: unknown): Promise<{ ok: true; total: number; headers: string[]; sample: string[][] } | { ok: false; error: string }> {
  const me = await requirePerm("tab.exportar");
  const req = cleanRequest(raw);
  if (!req) return { ok: false, error: "Escolha ao menos uma coluna." };
  if (!canExport(me, req.dataset)) return { ok: false, error: "Você não tem acesso a esta base." };
  try { return { ok: true, ...(await previewOf(req)) }; } catch { return { ok: false, error: "Não foi possível contar agora. Tente de novo." }; }
}
