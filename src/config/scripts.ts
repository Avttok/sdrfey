/** Scripts de ligação: tipos e listas usados pelo editor, pelo player e pelo servidor (sem banco, o navegador também usa). */
export type ScriptKind = "ok" | "objecao" | "neutro";
export type ScriptOption = { label: string; /** id do próximo passo; vazio = termina aqui. */ to: string | null; kind: ScriptKind; /** Anotação que esta resposta gera para a observação do lead (ex.: "Contato: decisor de compra"). */ note?: string };
/** O "papel" do passo na conversa: define ícone e cor na ligação. */
export type ScriptMood = "abertura" | "ponte" | "confirma" | "pergunta" | "proposta" | "objecao" | "fideliza" | "fechamento" | "apoio";
export type ScriptNode = {
  id: string;
  /** fala = o usuário fala; fim = encerra com um resultado. */
  type: "fala" | "fim";
  /** Nome curto do passo (aparece na trilha). */
  title: string;
  /** O que o usuário lê/fala. Aceita {empresa}, {contato}, {cidade}, {meunome}. */
  say: string;
  /** Dica de postura/objetivo do passo (opcional). */
  tip?: string;
  options: ScriptOption[];
  /** Papel do passo (ícone e cor). Se faltar, o sistema deduz pelo nome. */
  mood?: ScriptMood;
  /** Só para fim: o que fazer a seguir. */
  outcome?: "visita" | "cotacao" | "retorno" | "venda" | "encerrar";
};
export type ScriptDoc = { id: number; title: string; segment: string; goal: ScriptGoal; summary: string | null; nodes: ScriptNode[]; startId: string; global: boolean; mine: boolean; active: boolean };

export type ScriptGoal = "sdr" | "vendas" | "retorno" | "fidelizar";
export const GOALS: Record<ScriptGoal, { label: string; hint: string }> = {
  sdr: { label: "Prospecção (Operador SDR)", hint: "Despertar interesse e marcar visita" },
  vendas: { label: "Venda (Vendedor SDR)", hint: "Cotar e fechar com leads inativos ou repassados" },
  retorno: { label: "Retorno de cotação", hint: "Ligar para quem recebeu cotação" },
  fidelizar: { label: "Fidelização (Televendas)", hint: "Manter o cliente comprando e tirar dúvidas" },
};

export const SEGMENTS: Record<string, string> = {
  geral: "Geral",
  distribuidor_fixadores: "Distribuidor de fixadores",
  distribuidor_industrial: "Distribuidor industrial",
  parafusos: "Loja de parafusos",
  ferragens: "Loja de ferragens",
  material_construcao: "Material de construção",
  ferramentas: "Loja de ferramentas",
  autopecas: "Autopeças (varejo)",
  autopecas_atacado: "Autopeças (atacado)",
  posto_molas: "Posto de molas",
  auto_center: "Auto center",
  oficina_pesados: "Oficina de caminhões e ônibus",
  concessionaria: "Concessionária",
  transportadora_frota: "Transportadora e frotas",
  implementos: "Implementos rodoviários",
  carrocerias: "Carrocerias e ônibus",
  maquinas_agricolas: "Máquinas e implementos agrícolas",
  industria: "Indústria (manutenção)",
  metalurgica: "Metalúrgica e usinagem",
  serralheria: "Serralheria e estruturas",
  moveis: "Indústria de móveis",
  eletro_energia: "Energia e eletromecânica",
  construcao_pesada: "Construção e mineração",
};

export const OUTCOMES: Record<NonNullable<ScriptNode["outcome"]>, { label: string; hint: string }> = {
  visita: { label: "Marcar a visita", hint: "Registre a visita no Salesforce e agende no sistema." },
  cotacao: { label: "Enviar a cotação", hint: "Monte e envie a cotação ainda hoje." },
  retorno: { label: "Combinar um retorno", hint: "Anote o dia e o horário combinados na observação." },
  venda: { label: "Fechar a venda", hint: "Confirme condições e abra o pedido." },
  encerrar: { label: "Encerrar a conversa", hint: "Agradeça, registre o motivo e passe para o próximo." },
};

export const KIND_LABEL: Record<ScriptKind, string> = { ok: "Bom sinal", objecao: "Objeção", neutro: "Neutro" };

/** Nome de empresa falado em voz alta: sem "LTDA/ME/EIRELI" e sem GRITAR quando vem tudo em maiúsculas. */
export function spokenCompany(raw: string): string {
  let n = raw.replace(/\b(LTDA|EIRELI|S\/?A|ME|EPP|MEI|S\.A\.)\b\.?/gi, "").replace(/\s*[-–]\s*$/, "").replace(/\s{2,}/g, " ").trim();
  if (!n) n = raw.trim();
  if (n === n.toUpperCase() && /[A-ZÀ-Ú]{3,}/.test(n)) n = n.toLowerCase().replace(/(^|\s|-)([a-zà-ú])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
  return n;
}

const GENERIC = new Set(["comercial", "comercio", "comércio", "distribuidora", "distribuidor", "industria", "indústria", "industrial", "auto", "autopecas", "autopeças", "mecanica", "mecânica", "posto", "casa", "loja", "centro", "grupo", "irmaos", "irmãos", "metalurgica", "metalúrgica", "transportes", "transportadora", "materiais", "ferragens", "ferragem", "parafusos", "fixadores", "produtos", "servicos", "serviços", "pecas", "peças", "maquinas", "máquinas", "ferramentas", "implementos", "rodoviarios", "rodoviários", "e", "de", "da", "do", "dos", "das"]);

/** Nome para falar ao telefone: só o primeiro nome da empresa ("J R Mecânica" → "J R"; "Auto Peças Silva" → "Silva"). */
export function shortCompany(raw: string): string {
  const t = spokenCompany(raw).split(/\s+/).filter(Boolean);
  while (t.length > 1 && /^(a|o|as|os)$/i.test(t[0])) t.shift();
  if (!t.length) return raw.trim();
  const initials: string[] = [];
  for (const w of t) { if (/^[A-Za-zÀ-ú]\.?$/.test(w) && initials.length < 3) initials.push(w.replace(".", "")); else break; }
  if (initials.length >= 2) return initials.join(" ");
  return t.find((w) => !GENERIC.has(w.toLowerCase())) ?? t[0];
}

/**
 * Troca {empresa} (só o primeiro nome), {empresa_completa}, {contato}… pelos dados do lead. Quando falta o nome do contato no começo de uma frase,
 * a frase simplesmente começa sem ele ("João, vou direto" → "Vou direto"); no meio da frase vira "o responsável".
 * Toda frase sai com a primeira letra maiúscula.
 */
export function fillScript(text: string, v: { empresa?: string | null; contato?: string | null; cidade?: string | null; meunome?: string | null }): string {
  const get = (k: "empresa" | "contato" | "cidade" | "meunome" | "empresa_completa") => {
    const raw = ((k === "empresa_completa" ? v.empresa : v[k]) ?? "").trim();
    if (!raw) return "";
    if (k === "empresa") return shortCompany(raw);
    if (k === "empresa_completa") return spokenCompany(raw);
    if (k === "contato") return raw.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase()).replace(/(?<=.)./g, (c) => c.toLowerCase());
    return raw;
  };
  const alt: Record<string, string> = { empresa_completa: "a empresa", empresa: "sua empresa", contato: "o responsável", cidade: "a sua cidade", meunome: "eu" };
  // [[contato?texto com nome|texto sem nome]]: só aparece quando se sabe com quem se fala
  let out = text.replace(/\[\[contato\?([^|\]]*)\|([^\]]*)\]\]/g, (_, a: string, b: string) => (get("contato") ? a : b));
  if (!get("contato")) out = out.replace(/,\s*\{contato\}\?\s+(?=[A-ZÀ-Ú])/g, "! ").replace(/(^|[.!?]\s+|\n)\{contato\}[,!]?\s*/g, "$1").replace(/,\s*\{contato\}(?=[,.!?])/g, "");
  if (!get("cidade")) out = out.replace(/,?\s+de \{cidade\}/g, "");
  if (!get("empresa")) out = out.replace(/\b(da|na|pela|a|à|para a)\s+\{empresa\}/gi, "$1 empresa");
  if (!get("meunome")) out = out.replace(/Aqui é \{meunome\}, da Fey/g, "Aqui é da Fey");
  out = out.replace(/\{(empresa_completa|empresa|contato|cidade|meunome)\}/g, (_, k: string) => get(k as "empresa") || alt[k]);
  return out.replace(/(^|[.!?]\s+|\n)([a-zà-ú])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

export const MOOD_KEYS: ScriptMood[] = ["abertura", "ponte", "confirma", "pergunta", "proposta", "objecao", "fideliza", "fechamento", "apoio"];

/** Papel do passo: o que o Adm/usuário escolheu ou, na falta, o que o código e o nome sugerem. */
export function moodOf(n: Pick<ScriptNode, "id" | "type" | "title" | "mood">): ScriptMood {
  if (n.mood) return n.mood;
  if (n.type === "fim") return "fechamento";
  const k = `${n.id} ${n.title}`.toLowerCase();
  if (/^conf_/.test(n.id)) return "confirma";
  if (/^fid_/.test(n.id)) return "fideliza";
  if (/^enr_/.test(n.id)) return "pergunta";
  if (/^obj|obje|caro|pre[cç]o|fornecedor|sem tempo|sem interesse|pessoa errada/.test(k)) return "objecao";
  if (/abertura|in[ií]cio/.test(k)) return "abertura";
  if (/recep|secret|assunto|quem|chegar|ponte/.test(k)) return "ponte";
  if (/pergunta|descoberta|d[uú]vida|motivo|entender/.test(k)) return "pergunta";
  if (/pitch|proposta|visita|desconto|interesse|apresent|cota/.test(k)) return "proposta";
  return "apoio";
}

/** Palavras que indicam o segmento do lead (nome + atividade). A primeira regra que bater vence; as mais específicas vêm antes. */
const SEGMENT_RULES: [string, RegExp][] = [
  ["posto_molas", /\b(mola|molas|feixe de mola|posto de mola)/],
  ["distribuidor_fixadores", /(distribuidor.*(parafus|fixador)|parafus.*distribui|fixador.*(atacad|distribui))/],
  ["parafusos", /(parafus|fixador|porca|arruela)/],
  ["autopecas_atacado", /(auto ?pe[cç]as?.*atacad|atacad.*auto ?pe[cç]as?|distribuidor.*(auto|pe[cç]as))/],
  ["autopecas", /(auto ?pe[cç]as?|pe[cç]as (para|p\/) ve[ií]culos|acess[oó]rios automotivos)/],
  ["oficina_pesados", /(caminh[oõ]|[oô]nibus|pesados|diesel)/],
  ["transportadora_frota", /(transport|frete|log[ií]stica|frota)/],
  ["carrocerias", /(carroceri|[oô]nibus)/],
  ["implementos", /(implement|carreta|reboque|rodovi[aá]ri)/],
  ["maquinas_agricolas", /(agr[ií]cola|agropecu|m[aá]quinas? agr|trator)/],
  ["auto_center", /(auto ?center|centro automotivo|mec[aâ]nic|oficina)/],
  ["concessionaria", /(concession|ve[ií]culos)/],
  ["construcao_pesada", /(terraplen|constru[cç][aã]o pesada|minera|escava)/],
  ["material_construcao", /(material de constru|constru[cç][aã]o|ferrag)/],
  ["ferramentas", /(ferrament)/],
  ["serralheria", /(serralh|esquadria|estrutura met)/],
  ["metalurgica", /(metal[uú]rg|usinagem|caldeiraria|fundi[cç])/],
  ["moveis", /(m[oó]veis|marcenar)/],
  ["eletro_energia", /(el[eé]tric|energia|subesta)/],
  ["industria", /(ind[uú]stria|fabrica[cç]|f[aá]brica)/],
  ["distribuidor_industrial", /(industrial.*(distribu|com[eé]rcio)|com[eé]rcio.*industrial)/],
];
export function guessSegment(...texts: (string | null | undefined)[]): string | null {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t.trim()) return null;
  return SEGMENT_RULES.find(([, re]) => re.test(t))?.[0] ?? null;
}
