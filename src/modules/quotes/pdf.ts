import { db } from "@/db";
import { upsertPaymentTerm } from "./db";
import { parseQuoteText, type ParsedQuote } from "./parse";

/** Lê um PDF de cotação/pedido em memória (sem validar permissão: quem chama já validou). */
export async function parsePdfFile(f: File): Promise<{ ok: true; quote: ParsedQuote } | { ok: false; message: string }> {
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
