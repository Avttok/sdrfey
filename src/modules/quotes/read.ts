"use server";

import { getSettings } from "@/modules/settings/get";
import { requireUser } from "@/modules/auth/guard";
import { parsePdfFile } from "./pdf";
import type { ParsedQuote } from "./parse";


/** Lê o PDF da cotação só em memória e devolve os campos. O arquivo nunca é gravado (disco, banco ou storage). */
export async function readQuotePdfAction(fd: FormData): Promise<{ ok: true; quote: ParsedQuote } | { ok: false; message: string }> {
  await requireUser();
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: "Escolha o PDF da cotação." };
  const maxMb = (await getSettings()).pdf_max_mb;
  if (f.size > maxMb * 1024 * 1024) return { ok: false, message: `PDF grande demais (máx. ${maxMb} MB).` };
  return parsePdfFile(f);
}

