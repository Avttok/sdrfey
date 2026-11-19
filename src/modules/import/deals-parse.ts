import { headerKey, normalizeCnpj, isValidCnpj, normalizeEmail, splitPhones, cleanText } from "./normalize";
import type { DealStage } from "@/db";
import type { QuoteItem } from "@/modules/quotes/parse";

/** Colunas aceitas na planilha do vendedor (sem acento, sem espaço, maiúsculo). */
export const DEAL_COLUMNS = {
  cnpj: ["CNPJ"],
  company: ["EMPRESA", "RAZAOSOCIAL", "CLIENTE", "NOMECLIENTE", "NOME"],
  contact: ["CONTATO", "NOMECONTATO"],
  phone: ["TELEFONE", "TELEFONES", "TEL", "FONE", "CELULAR", "WHATSAPP"],
  email: ["EMAIL"],
  city: ["CIDADE"],
  uf: ["UF", "ESTADO"],
  sapCode: ["CODSAP", "SAP", "CODIGOSAP", "CODIGODOCLIENTE"],
  stage: ["ETAPA", "STATUS", "SITUACAO", "FASE"],
  freight: ["FRETE", "ICOTERMS"],
  paymentTerms: ["CONDICAODEPAGAMENTO", "CONDICAOPAGAMENTO", "CONDPAGAMENTO", "PAGAMENTO"],
  quoteNumber: ["NCOTACAO", "NUMEROCOTACAO", "NUMERODACOTACAO", "COTACAO", "NCOT"],
  quoteDate: ["DATACOTACAO", "DATADACOTACAO"],
  quoteValue: ["VALORCOTACAO", "VALORDACOTACAO", "VALORTOTAL", "TOTAL"],
  netValue: ["VALORSEMIMPOSTOS", "VALORLIQUIDO", "LIQUIDO"],
  orderNumber: ["NPEDIDO", "NUMEROPEDIDO", "NUMERODOPEDIDO", "PEDIDO"],
  closedOn: ["DATAFECHADA", "DATAFECHAMENTO", "DATADAVENDA", "DATAVENDA"],
  closedValue: ["VALORFECHADO", "VALORVENDA", "VALORVENDIDO"],
  realValue: ["VALORREAL"],
  reactivation: ["REATIVADO", "REATIVACAO"],
  lostReason: ["MOTIVOPERDA", "MOTIVODAPERDA", "MOTIVO"],
  nextAt: ["PROXIMOCONTATO", "RETORNO", "VOLTARAFALAREM"],
  note: ["OBSERVACAO", "OBSERVACOES", "OBS", "ANOTACAO"],
} as const;
export type DealField = keyof typeof DEAL_COLUMNS;

export type DealDraft = {
  line: number; cnpj: string; company: string | null; contact: string | null; phones: string[]; email: string | null; city: string | null; uf: string | null; sapCode: string | null;
  stage: DealStage; freight: "CIF" | "FOB" | "RED" | null; paymentTerms: string | null;
  quoteNumber: string | null; quoteDate: string | null; quoteCents: number | null; netCents: number | null;
  orderNumber: string | null; closedOn: string | null; closedCents: number | null; realCents: number | null; reactivation: boolean;
  lostReason: string | null; nextAt: string | null; note: string | null;
  /** Vindos de um PDF anexado ao lead. */
  items?: QuoteItem[]; weightKg?: number | null; fromPdf?: string;
};
export type DealImportReport = { total: number; valid: number; duplicatesInFile: number; rejected: { line: number; reason: string; company?: string }[]; warnings: string[]; missingColumns: string[] };

const STAGES: Record<string, DealStage> = {
  NOVO: "novo", NOVA: "novo", CONTATO: "contato", EMCONTATO: "contato", PROSPECCAO: "contato",
  COTACAO: "cotacao", COTACAOENVIADA: "cotacao", ORCAMENTO: "cotacao", ENVIADA: "cotacao",
  NEGOCIACAO: "negociacao", NEGOCIANDO: "negociacao", EMNEGOCIACAO: "negociacao",
  GANHO: "ganho", GANHA: "ganho", FECHADO: "ganho", FECHADA: "ganho", VENDIDO: "ganho", VENDA: "ganho", FATURADO: "ganho",
  PERDIDO: "perdido", PERDIDA: "perdido", PERDEU: "perdido", CANCELADO: "perdido",
};

/** "R$ 1.234,56", "1234,56" ou "1234.56" → centavos. */
export function moneyToCents(v: unknown): number | null {
  const s = String(v ?? "").replace(/[R$\s]/gi, "");
  if (!s) return null;
  const n = /,/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : /^\d+\.\d{1,2}$/.test(s) ? Number(s) : Number(s.replace(/\./g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
/** "16/10/2026" ou "2026-10-16" → "2026-10-16". */
export function isoDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  let y: string, mo: string, d: string;
  if (m) [, d, mo, y] = m; else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) [, y, mo, d] = m; else return null;
  const dt = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00Z`);
  return Number.isNaN(dt.getTime()) ? null : `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
const yes = (v: unknown) => /^(S|SIM|X|1|TRUE|VERDADEIRO)$/i.test(String(v ?? "").trim());

export function parseDealRows(headers: string[], rows: Record<string, string>[]): { drafts: DealDraft[]; report: DealImportReport } {
  const byKey = new Map(headers.map((h) => [headerKey(h), h]));
  const col: Partial<Record<DealField, string>> = {};
  for (const f of Object.keys(DEAL_COLUMNS) as DealField[]) for (const a of DEAL_COLUMNS[f]) { const r = byKey.get(a); if (r !== undefined) { col[f] = r; break; } }
  const report: DealImportReport = { total: rows.length, valid: 0, duplicatesInFile: 0, rejected: [], warnings: [], missingColumns: col.cnpj ? [] : ["CNPJ"] };
  const drafts: DealDraft[] = [];
  if (report.missingColumns.length) return { drafts, report };
  const get = (r: Record<string, string>, f: DealField) => (col[f] ? cleanText(r[col[f]!]) : null);
  const seenOpen = new Set<string>();
  const seenClosed = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const company = get(r, "company");
    const { cnpj } = normalizeCnpj(r[col.cnpj!]);
    if (!cnpj || !isValidCnpj(cnpj)) return void report.rejected.push({ line, reason: "CNPJ ausente ou inválido", company: company ?? undefined });
    const stageTxt = get(r, "stage");
    const quoteNumber = get(r, "quoteNumber");
    const quoteCents = moneyToCents(get(r, "quoteValue"));
    const closedCents = moneyToCents(get(r, "closedValue"));
    const orderNumber = get(r, "orderNumber");
    const closedOn = isoDate(get(r, "closedOn"));
    let stage: DealStage;
    if (stageTxt) {
      const s = STAGES[headerKey(stageTxt)];
      if (!s) return void report.rejected.push({ line, reason: `Etapa desconhecida: ${stageTxt}`, company: company ?? undefined });
      stage = s;
    } else stage = orderNumber || closedOn || closedCents ? "ganho" : quoteNumber || quoteCents ? "cotacao" : "contato";
    const closed = stage === "ganho" || stage === "perdido";
    const key = closed ? `${cnpj}|${stage}|${orderNumber ?? quoteNumber ?? closedOn ?? ""}|${closedCents ?? quoteCents ?? ""}` : cnpj;
    const bag = closed ? seenClosed : seenOpen;
    if (bag.has(key)) { report.duplicatesInFile++; return; }
    bag.add(key);
    const fr = (get(r, "freight") ?? "").toUpperCase().slice(0, 3);
    const phones = splitPhones(get(r, "phone")).phones;
    drafts.push({
      line, cnpj, company, contact: get(r, "contact"), phones, email: normalizeEmail(get(r, "email")), city: get(r, "city"), uf: get(r, "uf")?.toUpperCase().slice(0, 2) ?? null, sapCode: get(r, "sapCode")?.replace(/^0+(?=\d)/, "") ?? null,
      stage, freight: fr === "CIF" || fr === "FOB" || fr === "RED" ? fr : null, paymentTerms: get(r, "paymentTerms"),
      quoteNumber, quoteDate: isoDate(get(r, "quoteDate")), quoteCents, netCents: moneyToCents(get(r, "netValue")),
      orderNumber, closedOn, closedCents, realCents: moneyToCents(get(r, "realValue")), reactivation: yes(get(r, "reactivation")),
      lostReason: get(r, "lostReason"), nextAt: isoDate(get(r, "nextAt")), note: get(r, "note"),
    });
    report.valid++;
  });
  if (!col.stage) report.warnings.push("Sem coluna ETAPA: a etapa será deduzida (pedido/data fechada = ganho; cotação = cotação enviada; senão, em contato).");
  return { drafts, report };
}

/** Modelo para o vendedor preencher. */
export const DEAL_TEMPLATE_HEADERS = ["CNPJ", "EMPRESA", "CONTATO", "TELEFONE", "EMAIL", "CIDADE", "UF", "COD SAP", "ETAPA", "FRETE", "CONDICAO DE PAGAMENTO", "N COTACAO", "DATA COTACAO", "VALOR COTACAO", "VALOR SEM IMPOSTOS", "N PEDIDO", "DATA FECHADA", "VALOR FECHADO", "VALOR REAL", "REATIVADO", "MOTIVO PERDA", "PROXIMO CONTATO", "OBSERVACAO"];
export const DEAL_TEMPLATE_ROWS = [
  ["00.000.000/0001-91", "EMPRESA EXEMPLO LTDA", "Maria", "(47) 99999-0000", "maria@exemplo.com", "Indaial", "SC", "123456", "cotacao", "CIF", "3X 35/63/91 DIAS", "20270001", "16/10/2026", "10.127,44", "", "", "", "", "", "NAO", "", "20/11/2026", "Cotação enviada por e-mail"],
  ["00.000.000/0001-91", "EMPRESA EXEMPLO LTDA", "Maria", "", "", "", "", "", "ganho", "CIF", "3X 35/63/91 DIAS", "20260900", "10/09/2026", "5.000,00", "", "P-8891", "20/09/2026", "5.000,00", "4.200,00", "NAO", "", "", "Primeira venda"],
];
