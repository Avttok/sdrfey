import { headerKey } from "./normalize";

/**
 * Nomes aceitos para cada coluna do CSV (sem acento, sem espaço, maiúsculo).
 * Para aceitar um nome novo de coluna, é só acrescentar aqui.
 */
export const LEAD_COLUMNS = {
  cnpj: ["CNPJ"],
  company: ["EMPRESA", "RAZAOSOCIAL", "NOMEEMPRESA", "NOME"],
  sapCode: ["CODSAP", "SAP", "CODIGOSAP"],
  contact: ["CONTATO", "NOMECONTATO"],
  phone: ["TELEFONE", "TELEFONES", "TEL", "FONE", "CELULAR"],
  role: ["CARGO"],
  email: ["EMAIL"],
  notes: ["OBSERVACAO", "OBSERVACOES", "OBS"],
  temperature: ["INTERESSE", "TEMPERATURA"],
  channel: ["MEIO", "MEIODECONTATO"],
  qualified: ["QUALIFICADO"],
  scheduled: ["AGENDADO"],
  status: ["SITUACAO"],
  owner: ["OPSDR", "RESPONSAVEL"],
  visit: ["VISITA"],
  size: ["PORTE"],
  capital: ["CAPITAL", "CAPITALSOCIAL"],
  updatedAt: ["ATT"],
  served: ["SHUFFLADO"],
} as const;

export type LeadField = keyof typeof LEAD_COLUMNS;

export const REP_COLUMNS = {
  esc: ["ESC"],
  manager: ["GESTOR"],
  team: ["EQUIPE"],
  sapCode: ["CODSAP", "SAP"],
  cnpj: ["CNPJ"],
  address: ["ENDERECO"],
  cep: ["CEP"],
  city: ["CIDADE"],
  uf: ["UF"],
  repName: ["NOMEREP", "REPRESENTANTE", "NOME"],
  active: ["ATIVO"],
} as const;

export type RepField = keyof typeof REP_COLUMNS;

/** Descobre qual coluna real do arquivo corresponde a cada campo. */
export function mapColumns<F extends string>(
  headers: string[],
  spec: Record<F, readonly string[]>,
): Partial<Record<F, string>> {
  const byKey = new Map(headers.map((h) => [headerKey(h), h]));
  const found: Partial<Record<F, string>> = {};
  for (const field of Object.keys(spec) as F[]) {
    for (const alias of spec[field]) {
      const real = byKey.get(alias);
      if (real !== undefined) {
        found[field] = real;
        break;
      }
    }
  }
  return found;
}
