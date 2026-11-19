"use server";

import { getSettings } from "@/modules/settings/get";
import { db } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { upsertPaymentTerm } from "./db";
import { parseQuoteText, type ParsedQuote } from "./parse";


/** Lê o PDF da cotação só em memória e devolve os campos. O arquivo nunca é gravado (disco, banco ou storage). */
export async function readQuotePdfAction(fd: FormData): Promise<{ ok: true; quote: ParsedQuote } | { ok: false; message: string }> {
  await requireUser();
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: "Escolha o PDF da cotação." };
  const maxMb = (await getSettings()).pdf_max_mb;
  if (f.size > maxMb * 1024 * 1024) return { ok: false, message: `PDF grande demais (máx. ${maxMb} MB).` };
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const quote = parseQuoteText(text);
    if (!quote.quoteNumber && !quote.totalCents && !quote.cnpj) return { ok: false, message: "Não encontrei dados de cotação nesse PDF." };
    /* a condição de pagamento lida entra na lista do dropdown (só o texto, o PDF não é guardado) */
    quote.paymentTerms = await upsertPaymentTerm(db, quote.paymentTerms);
    return { ok: true, quote };
  } catch {
    return { ok: false, message: "Não consegui ler esse PDF. Preencha os campos manualmente." };
  }
}
