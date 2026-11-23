import { LEAD_COLUMNS, REP_COLUMNS } from "./columns";
import { CARRIER_COLUMNS } from "@/modules/carriers/parse";
import { DEAL_COLUMNS } from "./deals-parse";
import { headerKey } from "./normalize";

/** Arquivo sem banco, usado pelo navegador: dá nome, explicação e sugestão a cada coluna da planilha. */
export type ImportKind = "leads" | "reps" | "deals" | "carriers";
export type FieldInfo = { key: string; label: string; hint: string; /** Nome de coluna que o sistema entende. */ header: string; aliases: readonly string[]; required?: boolean };

const mk = (aliases: Record<string, readonly string[]>, info: Record<string, [label: string, hint: string, header: string]>, required: string[]): FieldInfo[] =>
  Object.keys(info).map((key) => ({ key, label: info[key][0], hint: info[key][1], header: info[key][2], aliases: aliases[key] ?? [], required: required.includes(key) }));

const LEADS = mk(LEAD_COLUMNS, {
  cnpj: ["CNPJ", "Identifica a empresa (com ou sem pontos)", "CNPJ"],
  company: ["Razão Social", "Nome da empresa como na Receita", "EMPRESA"],
  sapCode: ["Código SAP", "Código do cliente no SAP", "COD SAP"],
  eoxId: ["Registro EOX", "Número do cadastro na EOX (o record= do link). Faz o Atendimento da EOX abrir", "IDEMPRESA"],
  eoxCode: ["Código EOX", "Código do cliente na EOX (ex.: 117805). Diferente do Id; ajuda a achar o cadastro pela integração", "CODEOX"],
  sfId: ["Id Salesforce", "Id da conta no Salesforce", "IDSF"],
  contact: ["Nome do contato", "Pessoa que atende", "CONTATO"],
  phone: ["Telefone", "Pode ter vários, separados por vírgula", "TELEFONE"],
  role: ["Cargo do contato", "Ex.: Compradora, Gerente", "CARGO"],
  email: ["E-mail", "Um e-mail válido", "EMAIL"],
  notes: ["Observações", "Texto livre guardado no lead", "OBSERVACAO"],
  temperature: ["Interesse (temperatura)", "Quente, morno ou frio", "INTERESSE"],
  channel: ["Meio de contato", "Ligação, WhatsApp, e-mail…", "MEIO"],
  qualified: ["Qualificado", "SIM ou NAO", "QUALIFICADO"],
  scheduled: ["Agendado", "SIM ou NAO", "AGENDADO"],
  status: ["Situação", "Situação do atendimento", "SITUACAO"],
  owner: ["Responsável (SDR)", "Primeiro nome do usuário", "OP SDR"],
  visit: ["Visita anterior", "Código de visita já marcada", "VISITA"],
  size: ["Porte", "ME, EPP, Grande…", "PORTE"],
  capital: ["Capital social", "Valor em reais", "CAPITAL"],
  updatedAt: ["Data da última atualização", "dd/mm/aaaa", "ATT"],
  served: ["Vezes atendido", "Quantas vezes já passou pelo shuffler", "SHUFFLADO"],
}, ["cnpj", "company"]);

const REPS = mk(REP_COLUMNS, {
  esc: ["Escritório", "Ex.: ESC 01", "ESC"],
  manager: ["Gestor", "Nome do gestor da equipe", "GESTOR"],
  team: ["Equipe", "Nome da equipe", "EQUIPE"],
  sapCode: ["Código SAP", "Código único do representante", "COD SAP"],
  cnpj: ["CNPJ", "CNPJ do representante", "CNPJ"],
  address: ["Endereço", "Rua e número", "ENDERECO"],
  cep: ["CEP", "Somente números ou com traço", "CEP"],
  city: ["Cidade", "Usada para achar o representante mais próximo", "CIDADE"],
  uf: ["UF", "Sigla do estado com 2 letras", "UF"],
  repName: ["Nome do representante", "Nome ou razão social", "NOME REP"],
  active: ["Ativo", "SIM ou NAO", "ATIVO"],
}, ["sapCode", "repName"]);

const DEALS = mk(DEAL_COLUMNS, {
  cnpj: ["CNPJ do cliente", "Identifica o cliente", "CNPJ"],
  company: ["Razão Social", "Nome da empresa como na Receita", "EMPRESA"],
  contact: ["Nome do contato", "Pessoa que atende", "CONTATO"],
  phone: ["Telefone", "Pode ter vários", "TELEFONE"],
  email: ["E-mail", "Um e-mail válido", "EMAIL"],
  city: ["Cidade", "Cidade do cliente", "CIDADE"],
  uf: ["UF", "Sigla do estado", "UF"],
  sapCode: ["Código SAP", "Código do cliente no SAP", "COD SAP"],
  stage: ["Etapa da negociação", "Cotação, ganho, perdido…", "ETAPA"],
  freight: ["Frete", "CIF, FOB ou RED", "FRETE"],
  paymentTerms: ["Condição de pagamento", "Ex.: 3X 35/63/91 DIAS", "CONDICAO DE PAGAMENTO"],
  quoteNumber: ["Nº da cotação", "Número da cotação enviada", "N COTACAO"],
  quoteDate: ["Data da cotação", "dd/mm/aaaa", "DATA COTACAO"],
  quoteValue: ["Valor total da cotação", "Em reais", "VALOR COTACAO"],
  netValue: ["Valor sem impostos", "Total menos os impostos", "VALOR SEM IMPOSTOS"],
  orderNumber: ["Nº do pedido", "Número do pedido faturado", "N PEDIDO"],
  closedOn: ["Data da venda", "Quando faturou", "DATA FECHADA"],
  closedValue: ["Valor vendido", "Valor do pedido faturado", "VALOR FECHADO"],
  realValue: ["Valor real", "O que conta na métrica e comissão", "VALOR REAL"],
  reactivation: ["Reativação", "SIM se o cliente voltou a comprar", "REATIVADO"],
  lostReason: ["Motivo da perda", "Por que a venda não saiu", "MOTIVO PERDA"],
  nextAt: ["Próximo contato", "Data de retorno", "PROXIMO CONTATO"],
  note: ["Observações", "Texto livre", "OBSERVACAO"],
}, ["cnpj"]);

const CARRIERS = mk(CARRIER_COLUMNS, {
  uf: ["UF", "Estado a que a tabela de frete se refere", "UF"],
  mode: ["Tipo de frete", "CIF, FOB ou RED (redespacho)", "Tipo"],
  name: ["Transportadora", "Nome da transportadora", "Transportadora"],
  capitalPct: ["% Capital", "Percentual do frete para a capital", "% Capital"],
  interiorPct: ["% Interior", "Percentual do frete para o interior", "% Interior"],
  capitalDays: ["Dias Capital", "Prazo de entrega na capital, em dias", "Dias Capital"],
  interiorDays: ["Dias Interior", "Prazo de entrega no interior, em dias", "Dias Interior"],
  minCents: ["Frete mínimo", "Valor mínimo do frete, em reais", "Frete mínimo"],
  contact: ["Contato", "Nome ou telefone da transportadora", "Contato"],
  note: ["Observação", "Texto livre (ex.: coleta às terças)", "Obs"],
}, ["uf", "mode", "name"]);

export const FIELDS: Record<ImportKind, FieldInfo[]> = { leads: LEADS, reps: REPS, deals: DEALS, carriers: CARRIERS };

/** Qual campo o nome desta coluna já significa (ou null se o sistema não reconhece). */
export function fieldOfHeader(kind: ImportKind, header: string): FieldInfo | null {
  const k = headerKey(header);
  return FIELDS[kind].find((f) => f.aliases.includes(k)) ?? null;
}

export const IGNORE_HEADER = "IGNORAR";

const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
type Sniff = "cnpj" | "email" | "phone" | "date" | "money" | "uf" | "sap";

/** Olha os valores da coluna e diz o que ela parece ser (ou null). */
export function sniffColumn(values: string[]): Sniff | null {
  const v = values.map((x) => x.trim()).filter(Boolean).slice(0, 40);
  if (v.length < 2) return null;
  const share = (fn: (s: string) => boolean) => v.filter(fn).length / v.length;
  const digits = (s: string) => s.replace(/\D/g, "");
  if (share((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) >= 0.6) return "email";
  if (share((s) => { const d = digits(s); return d.length >= 12 && d.length <= 14 && /^[\d./-]+$/.test(s); }) >= 0.6) return "cnpj";
  if (share((s) => UFS.has(s.toUpperCase())) >= 0.7) return "uf";
  if (share((s) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s)) >= 0.6) return "date";
  if (share((s) => /^R?\$?\s*\d{1,3}(\.\d{3})*,\d{2}$/.test(s) || /^R\$/.test(s)) >= 0.6) return "money";
  if (share((s) => { const d = digits(s); return /^[\d\s()+-]+$/.test(s) && d.length >= 8 && d.length <= 13 && (/[()\s-]/.test(s) || d.length >= 10); }) >= 0.6) return "phone";
  if (share((s) => /^\d{5,8}$/.test(s)) >= 0.7) return "sap";
  return null;
}

const SNIFF_TO_FIELD: Record<ImportKind, Partial<Record<Sniff, string>>> = {
  leads: { cnpj: "cnpj", email: "email", phone: "phone", sap: "sapCode", date: "updatedAt", money: "capital" },
  reps: { cnpj: "cnpj", sap: "sapCode", uf: "uf" },
  deals: { cnpj: "cnpj", email: "email", phone: "phone", sap: "sapCode", date: "quoteDate", money: "quoteValue", uf: "uf" },
  carriers: { uf: "uf", money: "minCents", phone: "contact" },
};

/** Pistas pelo nome do título quando o conteúdo não basta (ex.: "Razão", "Mail", "Fone"). */
const HEADER_HINTS: [RegExp, Partial<Record<ImportKind, string>>][] = [
  [/raz|empresa|cliente|fantasia/, { leads: "company", deals: "company", reps: "repName" }],
  [/mail/, { leads: "email", deals: "email" }],
  [/fone|tel|cel|whats|zap/, { leads: "phone", deals: "phone" }],
  [/obs|anota|coment/, { leads: "notes", deals: "note" }],
  [/contato|comprador|respons/, { leads: "contact", deals: "contact" }],
  [/cargo|funcao/, { leads: "role" }],
  [/cidade|municipio/, { reps: "city", deals: "city" }],
  [/cota/, { deals: "quoteNumber" }],
  [/pedido/, { deals: "orderNumber" }],
  [/transport|nomedatransp|empresa/, { carriers: "name" }],
  [/frete|tipo|modal|cif|fob/, { carriers: "mode" }],
  [/estado/, { carriers: "uf" }],
  [/obs|anota/, { carriers: "note" }],
];

export function suggestField(kind: ImportKind, values: string[], header = ""): FieldInfo | null {
  const hk = headerKey(header).toLowerCase();
  const byName = hk && HEADER_HINTS.find(([re, m]) => re.test(hk) && m[kind]);
  if (byName) { const f = FIELDS[kind].find((x) => x.key === byName[1][kind]); if (f) return f; }
  const s = sniffColumn(values);
  const key = s && SNIFF_TO_FIELD[kind][s];
  return (key && FIELDS[kind].find((f) => f.key === key)) || null;
}

/** "A", "B", … "Z", "AA"… */
export const colLetter = (i: number): string => { let n = i, s = ""; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };

/** A conferência recusou o arquivo só porque o sistema não entendeu as colunas: dá para resolver no editor. */
export const needsMapping = (message: string): boolean => /^Faltam colunas obrigat|^Nenhum representante encontrado/.test(message);
