/**
 * Leitura das planilhas exportadas da EOX (Empresas e Contatos). Funções puras: rodam no navegador,
 * porque os arquivos passam do limite de envio do servidor; só o resultado já resumido segue em lotes.
 */
import { headerKey, normalizeCnpj, normalizeEmail, onlyDigits, splitPhones, stripAccents } from "@/modules/import/normalize";

export type EoxPerson = { name: string; role: string; phones: string[]; email: string | null };
export type EoxCompany = {
  cnpj: string;
  company: string;
  code: string | null;
  recordId: string | null;
  tradeName: string | null;
  phones: string[];
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  zip: string | null;
  city: string | null;
  uf: string | null;
  isCustomer: boolean;
  info: Record<string, string>;
  people: EoxPerson[];
};

type Row = Record<string, string>;

/** Campos do retrato guardados no lead (rótulo da EOX → valor). */
export const INFO_FIELDS = [
  "Tipo", "Avaliação", "Segmento", "Classificação ABC", "Porte", "Estágio do ciclo de vida",
  "Código Vendedor", "Descrição Vendedor", "Responsável", "Nome do Gestor", "Representante de Vendas",
  "Discagens bloqueadas", "Motivo bloqueio", "Mensagens bloqueadas",
  "Data Último Pedido", "Valor Último Pedido", "Data Último Faturamento", "Valor Último Faturamento",
  "Ticket Médio", "Recompra Média", "Dias Venda", "Ultrapassada Recompra", "Frequencia de compra", "Canal de compra preferido",
  "Situação Financeira", "Saldo Devedor", "Limite de Crédito", "Potencial",
  "Último Contato", "Próximo Contato", "Data Cadastro", "Data Mudança Responsável",
] as const;

/** Acha a coluna pelo nome, ignorando acento, maiúscula e espaço. Devolve a primeira com esse nome. */
function pick(headers: string[]): (...names: string[]) => string | undefined {
  const keys = headers.map((h) => [headerKey(h), h] as const);
  return (...names) => {
    for (const n of names) { const k = headerKey(n); const hit = keys.find(([hk]) => hk === k); if (hit) return hit[1]; }
    return undefined;
  };
}

const clean = (v: unknown): string => String(v ?? "").trim().replace(/\s+/g, " ");
const nameKey = (v: unknown): string => stripAccents(clean(v)).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const digitsOrNull = (v: unknown): string | null => { const d = onlyDigits(v); return d && d !== "0" ? d : null; };

export type Parsed = { companies: EoxCompany[]; skipped: number; withoutCnpj: number; linkedRecords: number; ambiguous: number; people: number; };

/** Junta Empresas (+ Contatos, se houver). O Id do registro vem dos Contatos, ligado pelo nome da empresa quando só há uma com aquele nome. */
export function parseEoxSheets(empresas: { headers: string[]; rows: Row[] }, contatos?: { headers: string[]; rows: Row[] } | null): Parsed {
  const e = pick(empresas.headers);
  const cCnpj = e("CNPJ"), cName = e("EMPRESA"), cCode = e("IdEOX", "Código EOX", "Codigo EOX");
  if (!cCnpj || !cName) throw new Error("A planilha de Empresas precisa das colunas CNPJ e EMPRESA.");
  const cFantasy = e("Nome Fantasia"), cEmail = e("Email", "Email Alternativo");
  const phoneCols = ["Telefone", "Outro Telefone", "Telefone Alternativo", "WhatsApp"].map((n) => e(n)).filter((x): x is string => !!x);
  const cAddr = e("Endereço Faturamento"), cNum = e("Número Faturamento"), cDistrict = e("Bairro Faturamento"), cZip = e("CEP Faturamento"), cCity = e("Cidade Faturamento"), cUf = e("Estado Faturamento");
  const infoCols = INFO_FIELDS.map((f) => [f as string, e(f)] as [string, string | undefined]).filter((x): x is [string, string] => !!x[1]);

  const out: EoxCompany[] = [];
  const byName = new Map<string, EoxCompany[]>();
  let skipped = 0, withoutCnpj = 0;
  for (const r of empresas.rows) {
    const cnpj = normalizeCnpj(r[cCnpj]).cnpj;
    if (!cnpj) { r[cCnpj] ? withoutCnpj++ : skipped++; continue; }
    const phones: string[] = [];
    for (const c of phoneCols) for (const p of splitPhones(r[c]).phones) if (!phones.includes(p)) phones.push(p);
    const info: Record<string, string> = {};
    for (const [label, col] of infoCols) { const v = clean(r[col]); if (v) info[label] = v; }
    const addr = [clean(cAddr ? r[cAddr] : ""), clean(cNum ? r[cNum] : "")].filter(Boolean).join(", ");
    const co: EoxCompany = {
      cnpj, company: clean(r[cName]), code: digitsOrNull(cCode ? r[cCode] : ""), recordId: null,
      tradeName: clean((r[cFantasy!] ?? "")) || null, phones, email: normalizeEmail(r[cEmail!]),
      address: addr || null, neighborhood: clean((r[cDistrict!] ?? "")) || null, zip: digitsOrNull(r[cZip!]),
      city: clean((r[cCity!] ?? "")) || null, uf: clean((r[cUf!] ?? "")).toUpperCase().slice(0, 2) || null,
      isCustomer: info["Tipo"] === "Customer", info, people: [],
    };
    out.push(co);
    const k = nameKey(co.company);
    if (k) byName.set(k, [...(byName.get(k) ?? []), co]);
  }

  let linkedRecords = 0, ambiguous = 0, people = 0;
  if (contatos) {
    const c = pick(contatos.headers);
    const kRec = c("idEmpresa"), kCompany = c("Nome Empresa"), kName = c("Nome");
    if (!kRec || !kCompany) throw new Error("A planilha de Contatos precisa das colunas idEmpresa e Nome Empresa.");
    const kRole = c("Cargo"), kEmail = c("Email"), kPhones = ["Celular", "Telefone Escritório", "Telefone Residencial", "Telefone Alternativo"].map((n) => c(n)).filter((x): x is string => !!x);
    const recs = new Map<string, Set<string>>();
    for (const r of contatos.rows) {
      const id = digitsOrNull(r[kRec]); const k = nameKey(r[kCompany]);
      if (!id || !k) continue;
      (recs.get(k) ?? recs.set(k, new Set()).get(k)!).add(id);
      const list = byName.get(k);
      if (list?.length !== 1 || !kName) continue;
      const nm = clean(r[kName]);
      if (!nm) continue;
      const phones: string[] = [];
      for (const col of kPhones) for (const p of splitPhones(r[col]).phones) if (!phones.includes(p)) phones.push(p);
      const t = list[0];
      if (t.people.some((p) => nameKey(p.name) === nameKey(nm))) continue;
      t.people.push({ name: nm, role: clean(r[kRole!]), phones, email: normalizeEmail(r[kEmail!]) });
      people++;
    }
    for (const [k, list] of byName) {
      const ids = recs.get(k);
      if (!ids) continue;
      if (list.length === 1 && ids.size === 1) { list[0].recordId = [...ids][0]; linkedRecords++; } else ambiguous++;
    }
  }
  return { companies: out, skipped, withoutCnpj, linkedRecords, ambiguous, people };
}

/** "R$ 1.234,56" → 1234.56 (ou null). */
export function moneyOf(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Discagem bloqueada na EOX? */
export const isBlocked = (info: Record<string, string> | null | undefined): boolean => /^(sim|s|true|1)$/i.test(stripAccents(info?.["Discagens bloqueadas"] ?? "").trim());
