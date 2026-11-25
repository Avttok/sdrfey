/** Filas da Consulta EOX. A chave vai para o banco e para a tela. Sem acesso a banco: o navegador também usa. */
export type EoxList = { key: string; label: string; hint: string; icon: string; hex: string };
export const EOX_LISTS: EoxList[] = [
  { key: "new", label: "Ainda não consultados", hint: "A fila normal: leads que nunca foram procurados na EOX.", icon: "list", hex: "#8b5cf6" },
  { key: "deal_open", label: "Com negociação aberta", hint: "Prioriza o que os vendedores estão trabalhando.", icon: "handshake", hex: "#f59e0b" },
  { key: "qualified", label: "Qualificados", hint: "Leads com a tag Qualificado que ainda não foram consultados.", icon: "badge", hex: "#22c55e" },
  { key: "no_phone", label: "Sem telefone", hint: "Leads sem telefone válido: a EOX pode ter números que a Receita não tem.", icon: "phoneoff", hex: "#ef4444" },
  { key: "no_email", label: "Sem e-mail", hint: "Leads sem e-mail válido.", icon: "mailoff", hex: "#ec4899" },
  { key: "no_person", label: "Sem pessoa de contato", hint: "Sem contato cadastrado: traz os contatos que a EOX tem da empresa.", icon: "userx", hex: "#a855f7" },
  { key: "no_address", label: "Sem endereço ou CEP", hint: "Faltam dados de endereço (usados em cotações).", icon: "mappin", hex: "#06b6d4" },
  { key: "customers", label: "Clientes (negócio ganho)", hint: "Quem já comprou: mantém o retrato da EOX em dia.", icon: "crown", hex: "#16a34a" },
  { key: "retry_failed", label: "Que falharam antes", hint: "Tentamos e a EOX não respondeu ou não tem o cliente: tenta de novo.", icon: "rotate", hex: "#f43f5e" },
  { key: "age:30", label: "Consultados há mais de 30 dias", hint: "Atualiza dados antigos da EOX.", icon: "clock", hex: "#0ea5e9" },
  { key: "age:90", label: "Consultados há mais de 90 dias", hint: "Atualiza dados bem antigos da EOX.", icon: "clock", hex: "#6366f1" },
];
export const EOX_LIST_BY_KEY = new Map(EOX_LISTS.map((l) => [l.key, l]));
export const normEoxList = (v: unknown): string => (typeof v === "string" && EOX_LIST_BY_KEY.has(v) ? v : "new");

export const EOX_DAEMON_KEY = "eox_daemon";
export type EoxDaemonState = { on: boolean; by: number | null; byName: string | null; mine: boolean; scope: string; since: string | null; stoppedWhy: string | null };
