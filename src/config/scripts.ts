/** Scripts de ligação: tipos e listas usados pelo editor, pelo player e pelo servidor (sem banco, o navegador também usa). */
export type ScriptKind = "ok" | "objecao" | "neutro";
import type { ScriptTask } from "@/config/tasks";
export type ScriptOption = { /** Dado que esta resposta grava no lead (campo do catálogo + valor). */ fact?: { key: string; value: string }; /** Tarefas que esta resposta gera (ligar daqui a 2 dias, enviar e-mail…). Vazio = nenhuma, e ela dispensa o padrão do passo final. */ tasks?: ScriptTask[]; label: string; /** id do próximo passo; vazio = termina aqui. */ to: string | null; kind: ScriptKind; /** Anotação que esta resposta gera para a observação do lead (ex.: "Contato: decisor de compra"). */ note?: string };
/** O "papel" do passo na conversa: define ícone e cor na ligação. */
export type ScriptMood = "abertura" | "ponte" | "confirma" | "pergunta" | "proposta" | "objecao" | "fideliza" | "fechamento" | "apoio";
/** O jeito de falar: o caminho da conversa é o mesmo, muda o tom das frases. */
export type ScriptTone = "normal" | "formal" | "solto";
export const TONE_KEYS: ScriptTone[] = ["normal", "formal", "solto"];
export const TONES: Record<ScriptTone, { label: string; hint: string }> = {
  normal: { label: "Normal", hint: "Profissional e natural, o equilíbrio de sempre" },
  formal: { label: "Formal", hint: "Mais polido e cerimonioso, sem exagero" },
  solto: { label: "Solto", hint: "Amigável, leve e cordial" },
};
export type ScriptNode = {
  id: string;
  /** fala = o usuário fala; fim = encerra com um resultado. */
  type: "fala" | "fim";
  /** Nome curto do passo (aparece na trilha). */
  title: string;
  /** O que o usuário lê/fala. Aceita {empresa}, {contato}, {cidade}, {meunome}. */
  say: string;
  /** A mesma fala nos outros tons. Se faltar um, vale a fala normal. */
  v?: { formal?: string; solto?: string };
  /** Dica de postura/objetivo do passo (opcional). */
  tip?: string;
  options: ScriptOption[];
  /** Papel do passo (ícone e cor). Se faltar, o sistema deduz pelo nome. */
  mood?: ScriptMood;
  /** Tarefas padrão de um passo final (quando nenhuma resposta do caminho declarou as suas). */
  tasks?: ScriptTask[];
  /** Só para fim: o que fazer a seguir. */
  /** Pergunta extra de dados: o vendedor escolhe/digita o que o cliente disse e isso grava no lead. */
  ask?: { key: string; /** pergunta curta para o vendedor (se faltar, usa o nome do campo) */ q?: string }[];
  outcome?: "visita" | "cotacao" | "retorno" | "venda" | "indicacao" | "encerrar";
};
export type ScriptDoc = { id: number; title: string; segment: string; goal: ScriptGoal; summary: string | null; nodes: ScriptNode[]; startId: string; global: boolean; mine: boolean; active: boolean };

export type ScriptGoal = "sdr" | "vendas" | "retorno" | "fidelizar" | "reativar" | "visita";
export const GOALS: Record<ScriptGoal, { label: string; hint: string }> = {
  sdr: { label: "Prospecção (Operador SDR)", hint: "Despertar interesse e marcar visita" },
  vendas: { label: "Venda (Vendedor SDR)", hint: "Cotar e fechar com leads inativos ou repassados" },
  retorno: { label: "Retorno de cotação", hint: "Ligar para quem recebeu cotação" },
  fidelizar: { label: "Fidelização (Televendas)", hint: "Manter o cliente comprando e tirar dúvidas" },
  reativar: { label: "Reativação (Clientes inativos)", hint: "Retomar contato com quem tem cadastro e está parado" },
  visita: { label: "Visita (Confirmação e pós-visita)", hint: "Confirmar, lembrar ou remarcar a visita e ligar depois dela" },
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
  visita: { label: "Visita marcada ou confirmada", hint: "Registre a visita no sistema (ou confirme a que já existe) e avise o representante." },
  cotacao: { label: "Enviar a cotação", hint: "Monte e envie a cotação ainda hoje." },
  retorno: { label: "Combinar um retorno", hint: "Anote o dia e o horário combinados na observação." },
  venda: { label: "Fechar a venda", hint: "Confirme condições e abra o pedido." },
  indicacao: { label: "Indicação recebida", hint: "Cadastre a indicação (nome e telefone) e ligue para a empresa indicada." },
  encerrar: { label: "Encerrar a conversa", hint: "Agradeça, registre o motivo e passe para o próximo." },
};

/** A fala do passo no tom escolhido (cai na normal quando o tom não tem texto). */
export function sayOf(n: Pick<ScriptNode, "say" | "v">, tone: ScriptTone): string {
  return (tone === "normal" ? n.say : n.v?.[tone]?.trim() || n.say);
}

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
/** Saudação certa para a hora de Brasília: Bom dia, Boa tarde ou Boa noite. */
export function saudacao(now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(now)) % 24;
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

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
  out = out.replace(/\{saudacao\}/g, saudacao());
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

/** Postura sugerida para quem fala: um emoji e uma frase curta, só para o usuário (não entra no texto lido ao lead). */
export type Posture = { emoji: string; text: string };
const POSTURE_BY_ID: [RegExp, Posture][] = [
  [/^abertura$/, { emoji: "😊", text: "Sorria ao falar: o sorriso aparece na voz" }],
  [/^(secretaria|gk_quem|p_assistente)$/, { emoji: "🙏", text: "Gentil, pedindo uma ajuda" }],
  [/^(horario|rec_email)$/, { emoji: "🙂", text: "Cordial e prático; anote o que ouvir" }],
  [/^(transferido|quem)$/, { emoji: "🙂", text: "Leve e simpático, sem pressa" }],
  [/^(nome|papel|pedir_decisor)$/, { emoji: "😄", text: "Simpático, ritmo calmo" }],
  [/^assunto$/, { emoji: "🎯", text: "Direto e confiante, sem rodeio" }],
  [/^sem_resp$/, { emoji: "🗣️", text: "Fale devagar e repita o telefone" }],
  [/^wa_msg$/, { emoji: "✍️", text: "Mensagem curta e amigável" }],
  [/^p_socio$/, { emoji: "💼", text: "Firme e objetivo: o tempo dele vale ouro" }],
  [/^p_compras$/, { emoji: "📋", text: "Profissional e específico" }],
  [/^(p_gestor|p_operacao)$/, { emoji: "🔧", text: "Prático, falando do dia a dia dele" }],
  [/^(p_balcao|p_admin)$/, { emoji: "😊", text: "Simpático e humilde" }],
  [/^p_alcada$/, { emoji: "🧐", text: "Curioso, sem pressão" }],
  [/^conf_minimo$/, { emoji: "🧾", text: "Transparente e seguro" }],
  [/^conf_/, { emoji: "🤝", text: "Tranquilo, de igual para igual" }],
  [/^(impl|ganho)$/, { emoji: "🤔", text: "Empático e devagar: deixe ele falar" }],
  [/^contrato$/, { emoji: "🙂", text: "Leve e honesto" }],
  [/^(visita|v_prep)$/, { emoji: "📅", text: "Animado e objetivo; ofereça duas opções" }],
  [/^(visita_confirma|digital|reenviar|prazo|v_tempo|reat_depois)$/, { emoji: "🤝", text: "Combinado claro; repita dia e horário" }],
  [/^(pitch|proposta|reat_oferta|fid_reposicao|fid_catalogo)$/, { emoji: "🚀", text: "Entusiasmado, mas calmo" }],
  [/^(fechar|venda_extra)$/, { emoji: "✅", text: "Confiante e atencioso; confirme os dados" }],
  [/^(obj_ruim|v_problema|reat_tecnica|fid_tecnica|fid_pedido|duvida_tec)$/, { emoji: "😔", text: "Empático, voz mais baixa e atenta" }],
  [/^obj_tempo$/, { emoji: "⏱️", text: "Rápido e educado" }],
  [/^(obj_nao|obj_verba|obj_depois|obj_estoque|ret_ultima|motivo|v_cancela)$/, { emoji: "🕊️", text: "Sereno e agradecido, sem cobrança" }],
  [/^(obj_fornecedor|obj_satisfeito|obj_distribuidor)$/, { emoji: "😌", text: "Respeitoso; nunca critique o outro" }],
  [/^obj_/, { emoji: "🧘", text: "Calmo e acolhedor; não discuta" }],
  [/^fid_nps$/, { emoji: "🙂", text: "Leve e curioso; escute a nota" }],
  [/^fid_indica$/, { emoji: "😊", text: "Leve, sem pressão; pode ouvir não" }],
  [/^fid_/, { emoji: "💖", text: "Caloroso e grato" }],
  [/^(v_confirma|v_lembra)$/, { emoji: "😊", text: "Simpático e objetivo" }],
  [/^v_remarca$/, { emoji: "🙂", text: "Flexível, sem drama" }],
  [/^(v_pos|v_wa|v_horario)$/, { emoji: "😄", text: "Animado e curioso" }],
  [/^(reat_historico|reat_apresenta|reat_hoje|reat_motivo|reat_atualiza)$/, { emoji: "👂", text: "Curioso, sem cobrança; escute" }],
  [/^enr_/, { emoji: "👂", text: "Curioso e atento; faça silêncio depois" }],
  [/^duvidas$/, { emoji: "👂", text: "Atento: pergunte e escute" }],
];
const POSTURE_BY_MOOD: Record<ScriptMood, Posture> = {
  abertura: { emoji: "😊", text: "Sorria ao falar" },
  ponte: { emoji: "🙏", text: "Gentil, pedindo ajuda" },
  confirma: { emoji: "🤝", text: "Tranquilo, de igual para igual" },
  pergunta: { emoji: "👂", text: "Curioso e atento; escute" },
  proposta: { emoji: "🚀", text: "Entusiasmado, mas calmo" },
  objecao: { emoji: "🧘", text: "Calmo e acolhedor; não discuta" },
  fideliza: { emoji: "💖", text: "Caloroso e grato" },
  fechamento: { emoji: "✅", text: "Confiante e atencioso" },
  apoio: { emoji: "🙂", text: "Natural e cordial" },
};
/** Postura do passo: a regra do código do passo vence; na falta, a do papel (mood). */
export function postureOf(n: Pick<ScriptNode, "id" | "type" | "title" | "mood">): Posture {
  const hit = POSTURE_BY_ID.find(([re]) => re.test(n.id));
  return hit ? hit[1] : POSTURE_BY_MOOD[moodOf(n)];
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
