/** Filas da Consulta EOX. A chave vai para o banco e para a tela. Sem acesso a banco: o navegador também usa. */
export type EoxList = { key: string; label: string; hint: string; group: (typeof EOX_GROUPS)[number]; icon: string; hex: string };
export const EOX_GROUPS = ["Fila", "Dados que faltam", "Reconferir"] as const;
const G = { f: "Fila", m: "Dados que faltam", r: "Reconferir" } as const;
export const EOX_LISTS: EoxList[] = [
  { key: "new", label: "Ainda não consultados", hint: "A fila normal: leads que nunca foram procurados na EOX.", group: G.f, icon: "list", hex: "#8b5cf6" },
  { key: "fresh", label: "Cadastrados esta semana", hint: "Leads novos (últimos 7 dias) que ainda não foram procurados na EOX.", group: G.f, icon: "sparkles", hex: "#0ea5e9" },
  { key: "unworked", label: "Nunca atendidos", hint: "Sem nenhum atendimento ainda: os que o shuffler vai sortear primeiro.", group: G.f, icon: "target", hex: "#14b8a6" },
  { key: "deal_open", label: "Com negociação aberta", hint: "Prioriza o que os vendedores estão trabalhando.", group: G.f, icon: "handshake", hex: "#f59e0b" },
  { key: "qualified", label: "Qualificados", hint: "Leads com a tag Qualificado.", group: G.f, icon: "badge", hex: "#22c55e" },
  { key: "customers", label: "Clientes (negócio ganho)", hint: "Quem já comprou: mantém o retrato da EOX em dia.", group: G.f, icon: "crown", hex: "#16a34a" },
  { key: "no_link", label: "Sem Código/link do perfil EOX", hint: "Leads sem o Código EOX (record=): a consulta grava o código e o link do perfil.", group: G.m, icon: "link", hex: "#6366f1" },
  { key: "no_phone", label: "Sem telefone", hint: "Leads sem telefone válido: a EOX pode ter números que a Receita não tem.", group: G.m, icon: "phoneoff", hex: "#ef4444" },
  { key: "no_mobile", label: "Sem celular", hint: "Só têm telefone fixo (ou nenhum): sem número de WhatsApp provável.", group: G.m, icon: "smartphone", hex: "#f97316" },
  { key: "one_phone", label: "Só um telefone", hint: "Tem apenas um número válido: busca outros para ter reserva.", group: G.m, icon: "phone", hex: "#eab308" },
  { key: "no_email", label: "Sem e-mail", hint: "Leads sem e-mail válido.", group: G.m, icon: "mailoff", hex: "#ec4899" },
  { key: "no_person", label: "Sem pessoa de contato", hint: "Sem contato cadastrado: traz os contatos que a EOX tem da empresa.", group: G.m, icon: "userx", hex: "#a855f7" },
  { key: "no_address", label: "Sem endereço ou CEP", hint: "Faltam dados de endereço (usados em cotações).", group: G.m, icon: "mappin", hex: "#06b6d4" },
  { key: "no_web", label: "Sem site e sem redes sociais", hint: "Nada de site, Facebook ou Linkedin.", group: G.m, icon: "globe", hex: "#3b82f6" },
  { key: "no_ie", label: "Sem Inscrição Estadual", hint: "Falta a IE (usada em cotações e pedidos).", group: G.m, icon: "shield", hex: "#64748b" },
  { key: "retry_failed", label: "Que falharam antes", hint: "Tentamos e a EOX não respondeu ou não tem o cliente: tenta de novo.", group: G.r, icon: "rotate", hex: "#f43f5e" },
  { key: "eox_blocked", label: "Com discagem bloqueada na EOX", hint: "A EOX marcou Discagens bloqueadas: confere se mudou.", group: G.r, icon: "ban", hex: "#dc2626" },
  { key: "eox_customers", label: "Clientes na EOX", hint: "Cadastro do tipo Cliente na EOX: atualiza vendedor, financeiro e última compra.", group: G.r, icon: "crown", hex: "#16a34a" },
  { key: "age:7", label: "Consultados há mais de 7 dias", hint: "Atualiza o retrato da EOX toda semana.", group: G.r, icon: "clock", hex: "#06b6d4" },
  { key: "age:30", label: "Consultados há mais de 30 dias", hint: "Atualiza dados antigos da EOX.", group: G.r, icon: "clock", hex: "#0ea5e9" },
  { key: "age:90", label: "Consultados há mais de 90 dias", hint: "Atualiza dados bem antigos da EOX.", group: G.r, icon: "clock", hex: "#6366f1" },
];
export const EOX_LIST_BY_KEY = new Map(EOX_LISTS.map((l) => [l.key, l]));
/** Fila por estado: "uf:SP" consulta os leads de SP que ainda não foram procurados. */
export const EOX_UF_KEY = /^uf:[A-Z]{2}$/;
export const eoxListMeta = (key: string): { label: string; hint: string; icon: string; hex: string } | undefined =>
  EOX_LIST_BY_KEY.get(key) ?? (EOX_UF_KEY.test(key) ? { label: `Estado ${key.slice(3)}`, hint: `Leads de ${key.slice(3)} que ainda não foram procurados na EOX.`, icon: "map", hex: "#0891b2" } : undefined);
export const normEoxList = (v: unknown): string => (typeof v === "string" && (EOX_LIST_BY_KEY.has(v) || EOX_UF_KEY.test(v)) ? v : "new");

export const EOX_DAEMON_KEY = "eox_daemon";
export type EoxDaemonState = { on: boolean; by: number | null; byName: string | null; mine: boolean; scope: string; since: string | null; stoppedWhy: string | null };
