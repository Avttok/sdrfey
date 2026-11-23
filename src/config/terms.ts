/**
 * GLOSSÁRIO DO SISTEMA — a fonte única dos nomes que a equipe vê (menus, abas, cargos, shufflers…).
 *
 * Como usar:
 *  • Nome novo? Acrescente uma linha em TERMS (chave estável + nome padrão).
 *  • Mudar um nome para sempre? Troque o `label` aqui e, se o nome antigo não pode mais aparecer, ponha-o em RETIRED:
 *    o teste `tests/terms.test.ts` falha se ele voltar a aparecer em qualquer arquivo do código.
 *  • Mudar sem mexer no código? O Adm faz isso em Painel Adm → Glossário (vira um "apelido" salvo no banco).
 *  • Textos já gravados no banco (tags, modelos, roteiros, avisos)? Painel Adm → Glossário → "Trocar termo no banco".
 *
 * Como o apelido chega à tela: os componentes de menu, títulos, selos de cargo e atalhos passam o texto por `applyTerm`,
 * que só troca quando o texto inteiro é exatamente o nome padrão de um termo (nunca mexe no meio de uma frase).
 */
export type Term = { key: string; label: string; group: string; hint?: string };

export const TERMS: Term[] = [
  { key: "shuffler_sdr", label: "Shuffler Prospecção", group: "Shufflers", hint: "O sorteio de leads novos (SDR)." },
  { key: "shuffler_sales", label: "Shuffler Vendas", group: "Shufflers", hint: "O sorteio de leads inativos (Vendas)." },
  { key: "lista_flow", label: "Lista Flow", group: "Shufflers", hint: "Montar a fila do Shuffler." },
  { key: "sdr", label: "SDR", group: "Cargos e menus", hint: "Cargo e menu do atendimento." },
  { key: "vendas", label: "Vendas", group: "Cargos e menus", hint: "Cargo e menu dos vendedores." },
  { key: "gestor", label: "Gestor", group: "Cargos e menus", hint: "Cargo de gestão." },
  { key: "adm", label: "Adm", group: "Cargos e menus", hint: "Cargo de administrador." },
  { key: "pessoas", label: "Pessoas", group: "Cargos e menus", hint: "Menu com Leads, Representantes e Transportadoras." },
  { key: "mais", label: "Mais", group: "Cargos e menus", hint: "Menu com modelos de e-mail e scripts." },
  { key: "sistema", label: "Sistema", group: "Cargos e menus", hint: "Menu do Adm." },
  { key: "dashboard", label: "Dashboard", group: "Abas" },
  { key: "visitas", label: "Visitas", group: "Abas" },
  { key: "tarefas", label: "Tarefas", group: "Abas", hint: "O que os scripts deixaram combinado: ligar de novo, enviar e-mail, enviar a cotação." },
  { key: "metas", label: "Metas", group: "Abas" },
  { key: "historico", label: "Histórico", group: "Abas" },
  { key: "desempenho", label: "Desempenho", group: "Abas" },
  { key: "negociacoes", label: "Negociações", group: "Abas" },
  { key: "leads", label: "Leads", group: "Abas" },
  { key: "representantes", label: "Representantes", group: "Abas" },
  { key: "transportadoras", label: "Transportadoras", group: "Abas" },
  { key: "modelos_email", label: "Modelos de E-mails", group: "Abas" },
  { key: "modelos_script", label: "Modelos de Scripts", group: "Abas" },
  { key: "registro", label: "Registro", group: "Abas" },
  { key: "exportar", label: "Exportar", group: "Abas" },
  { key: "painel_adm", label: "Painel Administrador", group: "Abas" },
  { key: "minha_conta", label: "Minha conta", group: "Abas" },
  { key: "douradovo", label: "Douradovo", group: "Extras", hint: "O selo de quem achou o segredo." },
];

/** Nome padrão de um termo (use em configs: `label: term("lista_flow")`). */
export const term = (key: string): string => {
  const t = TERMS.find((x) => x.key === key);
  if (!t) throw new Error(`Termo desconhecido: ${key}`);
  return t.label;
};

export type TermOverrides = Record<string, string>;
export const TERMS_KEY = "terms";
export const TERM_MAX = 40;

const BY_LABEL = new Map(TERMS.map((t) => [t.label, t.key]));

/** Limpa o que veio do banco/formulário: só chaves conhecidas, textos curtos, sem marcação. */
export function cleanOverrides(input: unknown): TermOverrides {
  const out: TermOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    const label = v.replace(/\s+/g, " ").trim();
    const def = TERMS.find((t) => t.key === k)?.label;
    if (!def || !label || label === def || label.length > TERM_MAX || /[<>]/.test(label)) continue;
    out[k] = label;
  }
  return out;
}

/** Troca um texto pelo apelido, mas só quando ele é exatamente o nome padrão de um termo. */
export function applyTerm(text: string, overrides: TermOverrides | undefined): string {
  if (!overrides) return text;
  const key = BY_LABEL.get(text);
  return (key && overrides[key]) || text;
}

/**
 * Nomes que foram aposentados: não podem reaparecer no código. Ao renomear um termo, acrescente o nome antigo aqui.
 * (Cada item é um trecho de texto; o teste procura em todos os arquivos de `src`.)
 */
export const RETIRED: { text: string; use: string }[] = [
  { text: "Shuffler de vendas", use: "Shuffler Vendas" },
  { text: "Shuffler de Vendas", use: "Shuffler Vendas" },
  { text: "Shuffler SDR", use: "Shuffler Prospecção" },
  { text: "Shuffler do SDR", use: "Shuffler Prospecção" },
];
