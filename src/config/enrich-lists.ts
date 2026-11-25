import { AGE_LISTS } from "@/modules/enrich/ages";

/** Listas que a consulta de CNPJ pode trabalhar. A chave vai para o banco e para a tela. Sem acesso a banco: o navegador também usa. */
export type EnrichList = { key: string; label: string; hint: string; group: "Fila" | "Dados que faltam" | "Reconferir"; /** nome do ícone (ver enrich-visual) */ icon: string; /** cor do cartão */ hex: string };

const CONTACT = (kind: string) => `não tem ${kind} válido`;
export const ENRICH_LISTS: EnrichList[] = [
  { key: "new", label: "Ainda não consultados", hint: "A fila normal: leads que nunca foram consultados.", group: "Fila", icon: "list", hex: "#6366f1" },
  { key: "fresh", label: "Cadastrados esta semana", hint: "Leads novos (últimos 7 dias) que ainda não foram consultados.", group: "Fila", icon: "sparkles", hex: "#0ea5e9" },
  { key: "unworked", label: "Nunca atendidos", hint: "Sem nenhum atendimento ainda e sem consulta: os que o shuffler vai sortear primeiro.", group: "Fila", icon: "target", hex: "#14b8a6" },
  { key: "qualified", label: "Qualificados sem consulta", hint: "Leads com a tag Qualificado que ainda não foram consultados.", group: "Fila", icon: "badge", hex: "#22c55e" },
  { key: "deal_open", label: "Com negociação aberta", hint: "Prioriza o que os vendedores estão trabalhando.", group: "Fila", icon: "handshake", hex: "#f59e0b" },
  { key: "no_phone", label: "Sem telefone", hint: `Leads que ${CONTACT("telefone")} (ou só têm números marcados como errados).`, group: "Dados que faltam", icon: "phoneoff", hex: "#ef4444" },
  { key: "no_mobile", label: "Sem celular", hint: "Só têm telefone fixo (ou nenhum): sem número de WhatsApp provável.", group: "Dados que faltam", icon: "smartphone", hex: "#f97316" },
  { key: "one_phone", label: "Só um telefone", hint: "Tem apenas um número válido: busca um segundo para ter reserva.", group: "Dados que faltam", icon: "phone", hex: "#eab308" },
  { key: "no_email", label: "Sem e-mail", hint: `Leads que ${CONTACT("e-mail")}.`, group: "Dados que faltam", icon: "mailoff", hex: "#ec4899" },
  { key: "no_contact", label: "Sem telefone e sem e-mail", hint: "Leads sem nenhum meio de contato: os mais difíceis de atender.", group: "Dados que faltam", icon: "ban", hex: "#dc2626" },
  { key: "wrong_phone", label: "Com telefone marcado como errado", hint: "Busca números novos para quem teve algum telefone errado.", group: "Dados que faltam", icon: "phonemissed", hex: "#f43f5e" },
  { key: "no_person", label: "Sem pessoa de contato", hint: "Sem nome de contato nem pessoa cadastrada.", group: "Dados que faltam", icon: "userx", hex: "#a855f7" },
  { key: "no_trade", label: "Sem nome fantasia", hint: "Só tem a razão social: o nome fantasia ajuda a achar o site e o Instagram.", group: "Dados que faltam", icon: "store", hex: "#8b5cf6" },
  { key: "no_address", label: "Sem endereço ou CEP", hint: "Faltam dados de endereço (usados em cotações).", group: "Dados que faltam", icon: "mappin", hex: "#06b6d4" },
  { key: "no_city", label: "Sem cidade ou estado", hint: "Faltam cidade/UF (afetam mapa e representante mais próximo).", group: "Dados que faltam", icon: "map", hex: "#0891b2" },
  { key: "no_status", label: "Sem situação cadastral", hint: "Sem a situação do CNPJ na Receita.", group: "Dados que faltam", icon: "shield", hex: "#64748b" },
  { key: "no_web", label: "Sem site e sem Instagram", hint: "Nada encontrado na internet sobre o lead.", group: "Dados que faltam", icon: "globe", hex: "#3b82f6" },
  { key: "retry_failed", label: "Que falharam antes", hint: "Já tentamos e nenhuma fonte respondeu: tenta de novo agora que o prazo passou.", group: "Reconferir", icon: "rotate", hex: "#f43f5e" },
  { key: "no_brasilapi", label: "Só com dados da ReceitaWS", hint: "Consultados, mas a BrasilAPI não respondeu: completa com ela.", group: "Reconferir", icon: "database", hex: "#6366f1" },
  { key: "customers", label: "Clientes (negócio ganho)", hint: "Quem já comprou: mantém os dados em dia.", group: "Reconferir", icon: "crown", hex: "#16a34a" },
  { key: "contacted_stale", label: "Já atendidos com dados antigos", hint: "Foram atendidos e a última consulta tem mais de 30 dias.", group: "Reconferir", icon: "history", hex: "#0ea5e9" },
  { key: "not_active", label: "CNPJ não ativo", hint: "Baixada, inapta ou suspensa: confere se mudou.", group: "Reconferir", icon: "alert", hex: "#ef4444" },
  ...AGE_LISTS.map((d): EnrichList => ({ key: `age:${d}`, label: `Consultados há mais de ${d} dias`, hint: "Atualiza dados antigos.", group: "Reconferir", icon: "clock", hex: "#8b5cf6" })),
];
export const ENRICH_LIST_BY_KEY = new Map(ENRICH_LISTS.map((l) => [l.key, l]));
/** Fila por estado: "uf:SP" consulta os leads ainda não consultados daquele estado. */
export const UF_KEY = /^uf:[A-Z]{2}$/;
export const listMeta = (key: string): { label: string; hint: string; icon: string; hex: string } | undefined =>
  ENRICH_LIST_BY_KEY.get(key) ?? (UF_KEY.test(key) ? { label: `Estado ${key.slice(3)}`, hint: `Leads de ${key.slice(3)} que ainda não foram consultados.`, icon: "map", hex: "#0891b2" } : undefined);
export const ENRICH_GROUPS = ["Fila", "Dados que faltam", "Reconferir"] as const;

/** Aceita a chave nova ou o formato antigo (número de dias; 0 = ainda não consultados). Desconhecido vira "new". */
export function normList(v: unknown): string {
  if (typeof v === "number") return v > 0 && ENRICH_LIST_BY_KEY.has(`age:${v}`) ? `age:${v}` : "new";
  if (typeof v === "string" && (ENRICH_LIST_BY_KEY.has(v) || UF_KEY.test(v))) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return normList(Number(v));
  return "new";
}
