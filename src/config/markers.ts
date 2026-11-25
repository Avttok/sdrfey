/**
 * Marcadores dos leads: calculados na hora a partir dos dados (site, redes sociais, telefone...), então nunca ficam desatualizados.
 * Aparecem como etiquetas nos leads, viram filtros na lista de Leads e respondem na busca geral ("site", "sem celular", "site e instagram").
 * Arquivo sem banco: o navegador também usa. As condições em SQL ficam em modules/leads/markers.ts.
 */
export type Marker = { key: string; label: string; color: string; hint: string; aliases: string[] };

export const MARKERS: Marker[] = [
  { key: "site", label: "Site", color: "#3b82f6", hint: "Tem site cadastrado", aliases: ["site", "sites", "website", "pagina", "pagina web", "tem site"] },
  { key: "redes", label: "Redes sociais", color: "#ec4899", hint: "Tem Instagram, Facebook ou LinkedIn", aliases: ["redes sociais", "rede social", "redes", "social", "tem redes sociais"] },
  { key: "instagram", label: "Instagram", color: "#e1306c", hint: "Tem Instagram", aliases: ["instagram", "insta", "ig"] },
  { key: "facebook", label: "Facebook", color: "#1877f2", hint: "Tem Facebook", aliases: ["facebook", "face", "fb"] },
  { key: "linkedin", label: "LinkedIn", color: "#0a66c2", hint: "Tem LinkedIn", aliases: ["linkedin", "linked in"] },
  { key: "celular", label: "Celular", color: "#22c55e", hint: "Tem número de celular (provável WhatsApp)", aliases: ["celular", "celulares", "whatsapp", "zap", "movel"] },
  { key: "telefone", label: "Telefone", color: "#0ea5e9", hint: "Tem algum telefone válido", aliases: ["telefone", "telefones", "fone", "tel"] },
  { key: "email", label: "E-mail", color: "#8b5cf6", hint: "Tem e-mail válido", aliases: ["email", "e-mail", "emails", "mail"] },
  { key: "contato", label: "Pessoa de contato", color: "#a855f7", hint: "Tem nome de contato ou pessoa cadastrada", aliases: ["contato", "pessoa", "pessoa de contato", "decisor", "comprador"] },
  { key: "endereco", label: "Endereço", color: "#06b6d4", hint: "Tem endereço e CEP", aliases: ["endereco", "cep", "endereço"] },
  { key: "consultado", label: "CNPJ consultado", color: "#6366f1", hint: "A consulta de CNPJ já foi feita", aliases: ["consultado", "cnpj consultado", "enriquecido", "pesquisado"] },
  { key: "ativo", label: "CNPJ ativo", color: "#16a34a", hint: "Situação ATIVA na Receita", aliases: ["ativo", "ativa", "cnpj ativo", "empresa ativa"] },
  { key: "mei", label: "MEI", color: "#f59e0b", hint: "Microempreendedor individual", aliases: ["mei", "microempreendedor"] },
  { key: "eox", label: "Na EOX", color: "#f97316", hint: "Tem Código EOX", aliases: ["eox", "na eox", "codigo eox"] },
  { key: "cliente", label: "Cliente", color: "#15803d", hint: "Já tem venda fechada", aliases: ["cliente", "clientes", "ja comprou", "comprou"] },
  { key: "negociacao", label: "Em negociação", color: "#d97706", hint: "Tem negociação aberta", aliases: ["negociacao", "em negociacao", "negociando", "negocio aberto"] },
  { key: "visita", label: "Com visita", color: "#14b8a6", hint: "Tem visita agendada ou feita", aliases: ["visita", "visitas", "com visita", "agendado"] },
  { key: "atendido", label: "Já atendido", color: "#64748b", hint: "Já teve algum contato registrado", aliases: ["atendido", "ja atendido", "contatado", "ja contatado"] },
  { key: "novo", label: "Novo", color: "#0891b2", hint: "Cadastrado nos últimos 7 dias", aliases: ["novo", "novos", "recente", "recentes"] },
];
export const MARKER_BY_KEY = new Map(MARKERS.map((m) => [m.key, m]));
/** Grupo virtual para os filtros da lista de Leads (mesmo formato do catálogo de tags). */
export const MARKER_GROUP = { key: "marcador", name: "Marcadores", exclusive: false, tags: MARKERS.map((m) => ({ id: -1, groupKey: "marcador", key: m.key, label: m.label, color: m.color, autoOnly: true })) };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const BY_ALIAS = new Map(MARKERS.flatMap((m) => [m.label, ...m.aliases].map((a) => [norm(a), m.key] as const)));

export type MarkerQuery = { has: string[]; not: string[] };
/**
 * Entende a busca como marcadores: "site", "redes sociais", "sem celular", "site e instagram", "site, sem email".
 * Só vale se TODAS as partes forem marcadores (senão é uma busca comum por nome).
 */
export function markerFromQuery(q: string): MarkerQuery | null {
  const parts = norm(q).split(/\s*(?:,|\+|;| e )\s*/).filter(Boolean);
  if (!parts.length || parts.length > 5) return null;
  const has: string[] = [], not: string[] = [];
  for (const p of parts) {
    const m = /^(?:sem|nao tem|nao possui|sem o|sem a)\s+(.+)$/.exec(p);
    const k = BY_ALIAS.get(m ? m[1] : p);
    if (!k) return null;
    (m ? not : has).push(k);
  }
  return { has: [...new Set(has)], not: [...new Set(not)] };
}
