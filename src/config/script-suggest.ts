import { moduleOf, MODULES, objKey, type ModuleCategory } from "@/config/script-modules";

/** O que o sistema sabe da conversa até agora. */
export type SuggestCtx = { goal: string; objective: string | null; /** módulos já percorridos */ visited: string[]; /** módulo do passo atual */ current: string | null; /** objeções enfrentadas (chave de módulo, ex.: obj:preco) */ objections: string[]; good: number; hurdles: number };
/** Números das ligações guardadas, por módulo. */
export type ModuleStat = { uses: number; wins: number; stops: number; taken: number };
export type Suggestion = { key: string; title: string; category: ModuleCategory; score: number; why: string; gallery: boolean; learned: number | null };

/** Depois de ouvir esta objeção, o que costuma ajudar (regra de partida, até haver dados). */
const AFTER: Record<string, string[]> = {
  "obj:preco": ["minimo", "obj:valor", "descoberta"], "obj:preco_cedo": ["descoberta", "minimo"], "obj:desconto": ["minimo", "obj:valor"], "obj:valor": ["descoberta", "pitch"],
  "obj:fornecedor": ["pitch", "descoberta", "obj:satisfeito"], "obj:satisfeito": ["descoberta", "pitch"], "obj:distribuidor": ["pitch", "descoberta"], "obj:concorrente": ["pitch", "descoberta"],
  "obj:enviar": ["visita", "descoberta"], "obj:pensar_geral": ["visita", "descoberta"], "obj:pensar": ["proposta", "descoberta"], "obj:depois": ["visita", "obj:tempo"], "obj:tempo": ["visita"],
  "obj:socio": ["perfil", "visita"], "obj:confianca": ["pitch", "obj:referencia"], "obj:ruim": ["descoberta", "pitch"], "obj:prazo": ["pitch", "descoberta"], "obj:qualidade": ["pitch", "obj:certificado"],
  "obj:minimo": ["minimo"], "obj:minimo2": ["minimo"], "obj:verba": ["minimo", "descoberta"], "obj:estoque": ["descoberta", "visita"],
};
const CLOSE: Record<string, string> = { sdr: "visita", visita: "visita", vendas: "proposta", retorno: "proposta", fidelizar: "fideliza", reativar: "reativa" };
const FLOW: string[] = ["perfil", "confirma", "pitch", "descoberta", "minimo", "visita", "proposta"];

/** Pontua os módulos que encaixam agora. Regras dão o ponto de partida; quanto mais ligações guardadas com o módulo, mais o resultado delas pesa. */
export function suggestModules(ctx: SuggestCtx, loadable: string[], stats: Record<string, ModuleStat>, max = 3): Suggestion[] {
  const out: Suggestion[] = []; const seen = new Set(ctx.visited);
  for (const key of loadable) {
    if (seen.has(key) || key === ctx.current) continue;
    const def = key.startsWith("obj:") ? { title: moduleOf(`obj_${key.slice(4)}`)?.title ?? key, category: "objecao" as ModuleCategory } : MODULES.find((m) => m.key === key && m.suggest);
    if (!def) continue;
    let prior = 0.2; let why = "";
    const last = ctx.objections[ctx.objections.length - 1];
    const rel = last ? AFTER[last] ?? [] : [];
    if (rel.includes(key)) { prior = 0.85 - rel.indexOf(key) * 0.1; why = `Costuma ajudar depois de “${moduleOf(`obj_${last.slice(4)}`)?.title ?? "objeção"}”`; }
    else if (key === CLOSE[ctx.goal] && ctx.good >= 2) { prior = 0.8; why = "Bons sinais do lead: hora de ir para o fechamento"; }
    else if (key === CLOSE[ctx.goal] && ctx.good >= 1 && ctx.hurdles === 0) { prior = 0.55; why = "Conversa fluindo sem objeções"; }
    else if (ctx.hurdles >= 2 && key === "descoberta") { prior = 0.7; why = "Várias objeções: deixe o lead falar mais"; }
    else if (key.startsWith("obj:")) { prior = ctx.objections.includes(key) ? 0.05 : 0.1; why = "Resposta pronta se o lead levantar"; }
    else { const i = FLOW.indexOf(key); const c = ctx.current ? FLOW.indexOf(ctx.current) : -1; if (i > c && i >= 0) { prior = 0.45 - (i - c - 1) * 0.06; why = "Próximo passo natural da conversa"; } }
    const s = stats[key]; let learned: number | null = null; let score = prior;
    if (s && s.uses > 0) {
      const k = 8; learned = (s.wins + 0.4 * k) / (s.uses + k); const w = Math.min(0.6, s.uses / (s.uses + 10));
      score = (1 - w) * prior + w * learned;
      why = `${why ? why + ". " : ""}${Math.round((s.wins / s.uses) * 100)}% das ${s.uses} ligações com este módulo terminaram bem`;
    }
    if (score > 0.25) out.push({ key, title: def.title, category: def.category, score, why: why || "Pode encaixar agora", gallery: false, learned });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

/** Chaves de módulo dos passos percorridos (sem repetir, em ordem). */
export function visitedModules(ids: string[]): string[] { const r: string[] = []; for (const id of ids) { const k = moduleOf(id)?.key; if (k && !r.includes(k)) r.push(k); } return r; }
export { objKey };
