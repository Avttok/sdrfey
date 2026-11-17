"use server";

import { requireUser } from "@/modules/auth/guard";
import { parseQuoteText, type ParsedQuote } from "./parse";

const MAX_BYTES = 5 * 1024 * 1024;

/** Lê o PDF da cotação só em memória e devolve os campos. O arquivo nunca é gravado (disco, banco ou storage). */
export async function readQuotePdfAction(fd: FormData): Promise<{ ok: true; quote: ParsedQuote } | { ok: false; message: string }> {
  await requireUser();
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: "Escolha o PDF da cotação." };
  if (f.size > MAX_BYTES) return { ok: false, message: "PDF grande demais (máx. 5 MB)." };
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const quote = parseQuoteText(text);
    if (!quote.quoteNumber && !quote.totalCents && !quote.cnpj) return { ok: false, message: "Não encontrei dados de cotação nesse PDF." };
    return { ok: true, quote };
  } catch {
    return { ok: false, message: "Não consegui ler esse PDF. Preencha os campos manualmente." };
  }
}
