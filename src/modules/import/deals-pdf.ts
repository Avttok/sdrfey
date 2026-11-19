import { parsePdfFile } from "@/modules/quotes/pdf";
import type { DealDraft } from "./deals-parse";

export type PdfMatch = { name: string; cnpj: string | null; matched: boolean; quoteNumber: string | null; items: number; note: string };

const MAX_PDFS = 60;

/** Lê os PDFs anexados (1 por lead, casando pelo CNPJ do PDF) e completa o que falta nas linhas da planilha. O PDF não é guardado. */
export async function attachPdfs(drafts: DealDraft[], files: File[], maxBytes: number): Promise<PdfMatch[]> {
  const out: PdfMatch[] = [];
  const used = new Set<string>();
  for (const f of files.slice(0, MAX_PDFS)) {
    if (f.size > maxBytes) { out.push({ name: f.name, cnpj: null, matched: false, quoteNumber: null, items: 0, note: "PDF grande demais" }); continue; }
    const r = await parsePdfFile(f);
    if (!r.ok) { out.push({ name: f.name, cnpj: null, matched: false, quoteNumber: null, items: 0, note: r.message }); continue; }
    const q = r.quote;
    if (!q.cnpj) { out.push({ name: f.name, cnpj: null, matched: false, quoteNumber: q.quoteNumber, items: q.items.length, note: "O PDF não traz CNPJ para ligar a um lead" }); continue; }
    const same = drafts.filter((d) => d.cnpj === q.cnpj);
    const d = same.find((x) => x.quoteNumber && x.quoteNumber === q.quoteNumber) ?? same.find((x) => !x.fromPdf);
    if (!d) { out.push({ name: f.name, cnpj: q.cnpj, matched: false, quoteNumber: q.quoteNumber, items: q.items.length, note: "Nenhuma linha da planilha com esse CNPJ" }); continue; }
    if (used.has(`${d.line}`)) { out.push({ name: f.name, cnpj: q.cnpj, matched: false, quoteNumber: q.quoteNumber, items: q.items.length, note: "Esse lead já recebeu outro PDF" }); continue; }
    used.add(`${d.line}`);
    d.fromPdf = f.name;
    d.quoteNumber ??= q.quoteNumber; d.quoteDate ??= q.quoteDate; d.quoteCents ??= q.totalCents; d.paymentTerms ??= q.paymentTerms; d.freight ??= q.freight; d.sapCode ??= q.sapCode;
    d.company ??= q.clientName; d.email ??= q.email; d.city ??= q.city; d.uf ??= q.uf;
    if (!d.phones.length && q.phone) d.phones = [q.phone.replace(/\D/g, "")].filter((p) => p.length >= 10 && p.length <= 11);
    d.items = q.items; d.weightKg = q.weightKg;
    if ((d.stage === "novo" || d.stage === "contato") && (q.totalCents || q.quoteNumber)) d.stage = "cotacao";
    out.push({ name: f.name, cnpj: q.cnpj, matched: true, quoteNumber: q.quoteNumber, items: q.items.length, note: `Ligado à linha ${d.line}` });
  }
  if (files.length > MAX_PDFS) out.push({ name: `+${files.length - MAX_PDFS} arquivos`, cnpj: null, matched: false, quoteNumber: null, items: 0, note: `Limite de ${MAX_PDFS} PDFs por importação` });
  return out;
}
