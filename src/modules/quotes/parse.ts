/** Leitura do texto de uma cotação (PDF da Fey). Função pura: só extrai campos, nada é salvo. */
export type QuoteItem = {
  seq: number; productCode: string; clientRef: string | null; description: string; kind: string | null;
  qty: number; packQty: number | null; unit: string | null;
  icmsCents: number | null; ipiCents: number | null; unitCents: number | null; totalCents: number | null;
};

export type ParsedQuote = {
  quoteNumber: string | null;
  quoteDate: string | null; // AAAA-MM-DD
  cnpj: string | null; // só dígitos
  clientName: string | null;
  sapCode: string | null;
  city: string | null;
  uf: string | null;
  paymentTerms: string | null;
  freight: "CIF" | "FOB" | "RED" | null;
  totalCents: number | null;
  productsCents: number | null;
  ipiCents: number | null;
  freightCents: number | null;
  validityDays: number | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  zip: string | null;
  stateReg: string | null;
  weightKg: number | null;
  typedBy: string | null;
  items: QuoteItem[];
};

const money = (s?: string) => {
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const NUM = String.raw`(\d[\d.]*,\d{2})`;
const ITEM_RE = new RegExp(String.raw`^(\d+)\s+(\d+)\s+(?:(.*?)\s+)?${NUM}\s+${NUM}\s+([A-Z]{2,4})\s+(.+?)\s+${NUM}\s+${NUM}\s+${NUM}\s+${NUM}$`);
const HEADER = /^(SEQ\b|C[óo]d\.|Produto$|Cliente$|OC\b|PADR[ÃA]O|Valores|ICMS|P[ÁA]GINA|\d+ DE \d+$)/i;
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Itens da tabela: cada item começa numa linha "SEQ CÓDIGO …" e pode continuar nas linhas seguintes. */
export function parseItems(lines: string[]): QuoteItem[] {
  const start = lines.findIndex((l) => /^ICMS\b/i.test(l) || /UNIT[ÁA]RIO\s+TOTAL/i.test(l));
  const body = lines.slice(start >= 0 ? start + 1 : 0);
  const records: string[] = [];
  for (const l of body) {
    if (/^(PRAZO DE ENTREGA|VALIDADE DA PROPOSTA|Valor Produtos|_{3,}|DATA:|NOME:|ASSINATURA:)/i.test(l)) break;
    if (!l || HEADER.test(l)) continue;
    if (/^\d{1,4}\s+\d+(\s|$)/.test(l) && Number(l.split(/\s+/)[0]) % 10 === 0) records.push(l);
    else if (records.length) records[records.length - 1] += ` ${l}`;
  }
  const out: QuoteItem[] = [];
  for (const r of records) {
    const m = r.replace(/\s+/g, " ").match(ITEM_RE);
    if (!m) continue;
    const desc = m[7].trim();
    out.push({
      seq: Number(m[1]), productCode: m[2], clientRef: m[3]?.trim() || null, description: desc,
      kind: desc.split(" ")[0]?.toUpperCase() || null, qty: num(m[4]), packQty: num(m[5]), unit: m[6],
      icmsCents: Math.round(num(m[8]) * 100), ipiCents: Math.round(num(m[9]) * 100), unitCents: Math.round(num(m[10]) * 100), totalCents: Math.round(num(m[11]) * 100),
    });
  }
  return out;
}

const LABELS = /^(Endere[çc]o|CEP|Caixa Postal|Transportadora|Redespacho|Inscri[çc][ãa]o Estadual|C[óo]digo do Cliente|Bairro|Estado|Cidade|Suframa|Condi[çc][õo]es de Pagamento|Icoterms|SEQ)\b/i;

export function parseQuoteText(raw: string): ParsedQuote {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const text = lines.join("\n");
  const m = (re: RegExp) => text.match(re)?.[1]?.trim() ?? null;

  const date = m(/Data da Cota[çc][ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i) ? text.match(/Data da Cota[çc][ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i)! : null;
  const cnpjRaw = m(/CNPJ\/CPF Cliente:\s*([\d./-]+)/i)?.replace(/\D/g, "") ?? null;

  let clientName = m(/Nome Cliente:[ \t]*(.*)/i);
  if (clientName !== null) {
    const i = lines.findIndex((l) => /^Nome Cliente:/i.test(l));
    const next = lines[i + 1];
    if (next && !next.includes(":") && !LABELS.test(next)) clientName = `${clientName} ${next}`.trim();
  }

  const sap = m(/C[óo]digo do Cliente:\s*(\d+)/i)?.replace(/^0+(?=\d)/, "") ?? null;
  const freight = m(/Icoterms\(Frete\):\s*(CIF|FOB|RED)/i)?.toUpperCase() as ParsedQuote["freight"] | null;
  const terms = m(/Condi[çc][õo]es de Pagamento:[ \t]*(.*)/i);
  const items = parseItems(lines);

  return {
    quoteNumber: m(/^COTA[ÇC][ÃA]O:\s*(\d+)/im),
    quoteDate: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
    cnpj: cnpjRaw && (cnpjRaw.length === 14 || cnpjRaw.length === 11) ? cnpjRaw : null,
    clientName: clientName || null,
    sapCode: sap,
    city: m(/^Cidade:[ \t]*(.+)$/im),
    uf: m(/^Estado:[ \t]*([A-Z]{2})\b/im),
    paymentTerms: terms || null,
    freight: freight ?? null,
    totalCents: money(m(/Valor Cota[çc][ãa]o:\s*([\d.,]+)/i) ?? undefined),
    productsCents: money(m(/Valor Produtos:\s*([\d.,]+)/i) ?? undefined),
    ipiCents: money(m(/Valor IPI:\s*([\d.,]+)/i) ?? undefined),
    freightCents: money(m(/Frete Negociado:\s*([\d.,]+)/i) ?? undefined),
    validityDays: Number(m(/VALIDADE DA PROPOSTA:\s*(\d+)/i)) || null,
    email: m(/E-?mail:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i)?.toLowerCase() ?? null,
    phone: (() => { const d = (m(/\nTelefone:[ \t]*([^\n]*)/i) ?? "").replace(/\D/g, ""); return d.length === 10 || d.length === 11 ? d : null; })(),
    address: m(/^Endere[çc]o:[ \t]*(.+)$/im),
    neighborhood: m(/^Bairro:[ \t]*(.+)$/im),
    zip: m(/^CEP:[ \t]*(\d{5}-?\d{3})/im)?.replace(/\D/g, "") ?? null,
    stateReg: m(/Inscri[çc][ãa]o Estadual:[ \t]*([\w./-]+)/i),
    weightKg: (() => { const w = m(/Peso Total:\s*([\d.,]+)/i); return w ? Number(w.replace(/\./g, "").replace(",", ".")) || null : null; })(),
    typedBy: m(/Digitador:[ \t]*(.+)/i),
    items,
  };
}
