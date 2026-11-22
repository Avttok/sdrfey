/** Scripts de ligação: tipos e listas usados pelo editor, pelo player e pelo servidor (sem banco, o navegador também usa). */
export type ScriptKind = "ok" | "objecao" | "neutro";
export type ScriptOption = { label: string; /** id do próximo passo; vazio = termina aqui. */ to: string | null; kind: ScriptKind };
/** O "papel" do passo na conversa: define ícone e cor no jogo. */
export type ScriptMood = "abertura" | "ponte" | "pergunta" | "proposta" | "objecao" | "fechamento" | "apoio";
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

export type ScriptGoal = "sdr" | "vendas" | "retorno";
export const GOALS: Record<ScriptGoal, { label: string; hint: string }> = {
  sdr: { label: "Prospecção (Operador SDR)", hint: "Despertar interesse e marcar visita" },
  vendas: { label: "Venda (Vendedor SDR)", hint: "Cotar e fechar com leads inativos ou repassados" },
  retorno: { label: "Retorno de cotação", hint: "Ligar para quem recebeu cotação" },
};

export const SEGMENTS: Record<string, string> = {
  geral: "Geral",
  posto_molas: "Posto de molas",
  auto_center: "Auto center",
  parafusos: "Loja de parafusos",
  ferramentas: "Loja de ferramentas",
  concessionaria: "Concessionária",
  industria: "Indústria",
  implementos: "Implementos rodoviários",
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

/**
 * Troca {empresa}, {contato}… pelos dados do lead. Quando falta o nome do contato no começo de uma frase,
 * a frase simplesmente começa sem ele ("João, vou direto" → "Vou direto"); no meio da frase vira "o responsável".
 * Toda frase sai com a primeira letra maiúscula.
 */
export function fillScript(text: string, v: { empresa?: string | null; contato?: string | null; cidade?: string | null; meunome?: string | null }): string {
  const get = (k: "empresa" | "contato" | "cidade" | "meunome") => {
    const raw = (v[k] ?? "").trim();
    if (!raw) return "";
    if (k === "empresa") return spokenCompany(raw);
    if (k === "contato") return raw.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase()).replace(/(?<=.)./g, (c) => c.toLowerCase());
    return raw;
  };
  const alt: Record<string, string> = { empresa: "sua empresa", contato: "o responsável", cidade: "a sua cidade", meunome: "eu" };
  let out = text;
  if (!get("contato")) out = out.replace(/(^|[.!?]\s+|\n)\{contato\}[,!]?\s*/g, "$1").replace(/,\s*\{contato\}(?=[,.!?])/g, "");
  if (!get("empresa")) out = out.replace(/\b(da|na|pela|a|à|para a)\s+\{empresa\}/gi, "$1 empresa");
  if (!get("meunome")) out = out.replace(/Aqui é \{meunome\}, da Fey/g, "Aqui é da Fey");
  out = out.replace(/\{(empresa|contato|cidade|meunome)\}/g, (_, k: string) => get(k as "empresa") || alt[k]);
  return out.replace(/(^|[.!?]\s+|\n)([a-zà-ú])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

export const MOOD_KEYS: ScriptMood[] = ["abertura", "ponte", "pergunta", "proposta", "objecao", "fechamento", "apoio"];

/** Papel do passo: o que o Adm/usuário escolheu ou, na falta, o que o código e o nome sugerem. */
export function moodOf(n: Pick<ScriptNode, "id" | "type" | "title" | "mood">): ScriptMood {
  if (n.mood) return n.mood;
  if (n.type === "fim") return "fechamento";
  const k = `${n.id} ${n.title}`.toLowerCase();
  if (/^obj|obje|caro|pre[cç]o|fornecedor|sem tempo|sem interesse|pessoa errada/.test(k)) return "objecao";
  if (/abertura|in[ií]cio/.test(k)) return "abertura";
  if (/recep|secret|assunto|quem|chegar|ponte/.test(k)) return "ponte";
  if (/pergunta|descoberta|d[uú]vida|motivo|entender/.test(k)) return "pergunta";
  if (/pitch|proposta|visita|desconto|interesse|apresent|cota/.test(k)) return "proposta";
  return "apoio";
}
