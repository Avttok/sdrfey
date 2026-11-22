import { AGE_LISTS } from "@/modules/enrich/ages";

/** Listas que a consulta de CNPJ pode trabalhar. A chave vai para o banco e para a tela. Sem acesso a banco: o navegador também usa. */
export type EnrichList = { key: string; label: string; hint: string; group: "Fila" | "Dados que faltam" | "Reconferir" };

const CONTACT = (kind: string) => `não tem ${kind} válido`;
export const ENRICH_LISTS: EnrichList[] = [
  { key: "new", label: "Ainda não consultados", hint: "A fila normal: leads que nunca foram consultados.", group: "Fila" },
  { key: "deal_open", label: "Com negociação aberta", hint: "Prioriza o que os vendedores estão trabalhando.", group: "Fila" },
  { key: "no_phone", label: "Sem telefone", hint: `Leads que ${CONTACT("telefone")} (ou só têm números marcados como errados).`, group: "Dados que faltam" },
  { key: "no_email", label: "Sem e-mail", hint: `Leads que ${CONTACT("e-mail")}.`, group: "Dados que faltam" },
  { key: "no_contact", label: "Sem telefone e sem e-mail", hint: "Leads sem nenhum meio de contato: os mais difíceis de atender.", group: "Dados que faltam" },
  { key: "wrong_phone", label: "Com telefone marcado como errado", hint: "Busca números novos para quem teve algum telefone errado.", group: "Dados que faltam" },
  { key: "no_person", label: "Sem pessoa de contato", hint: "Sem nome de contato nem pessoa cadastrada.", group: "Dados que faltam" },
  { key: "no_address", label: "Sem endereço ou CEP", hint: "Faltam dados de endereço (usados em cotações).", group: "Dados que faltam" },
  { key: "no_city", label: "Sem cidade ou estado", hint: "Faltam cidade/UF (afetam mapa e representante mais próximo).", group: "Dados que faltam" },
  { key: "no_status", label: "Sem situação cadastral", hint: "Sem a situação do CNPJ na Receita.", group: "Dados que faltam" },
  { key: "no_web", label: "Sem site e sem Instagram", hint: "Nada encontrado na internet sobre o lead.", group: "Dados que faltam" },
  { key: "not_active", label: "CNPJ não ativo", hint: "Baixada, inapta ou suspensa: confere se mudou.", group: "Reconferir" },
  ...AGE_LISTS.map((d): EnrichList => ({ key: `age:${d}`, label: `Consultados há mais de ${d} dias`, hint: "Atualiza dados antigos.", group: "Reconferir" })),
];
export const ENRICH_LIST_BY_KEY = new Map(ENRICH_LISTS.map((l) => [l.key, l]));
export const ENRICH_GROUPS = ["Fila", "Dados que faltam", "Reconferir"] as const;

/** Aceita a chave nova ou o formato antigo (número de dias; 0 = ainda não consultados). Desconhecido vira "new". */
export function normList(v: unknown): string {
  if (typeof v === "number") return v > 0 && ENRICH_LIST_BY_KEY.has(`age:${v}`) ? `age:${v}` : "new";
  if (typeof v === "string" && ENRICH_LIST_BY_KEY.has(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return normList(Number(v));
  return "new";
}
