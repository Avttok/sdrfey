/** Scripts de ligação: tipos e listas usados pelo editor, pelo player e pelo servidor (sem banco, o navegador também usa). */
export type ScriptKind = "ok" | "objecao" | "neutro";
export type ScriptOption = { label: string; /** id do próximo passo; vazio = termina aqui. */ to: string | null; kind: ScriptKind };
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

/** Troca {empresa}, {contato}… pelos dados do lead; o que faltar vira uma alternativa natural. */
export function fillScript(text: string, v: { empresa?: string | null; contato?: string | null; cidade?: string | null; meunome?: string | null }): string {
  const alt: Record<string, string> = { empresa: "a empresa", contato: "o responsável", cidade: "sua cidade", meunome: "eu" };
  return text.replace(/\{(empresa|contato|cidade|meunome)\}/g, (_, k: string) => (v as Record<string, string | null | undefined>)[k]?.trim() || alt[k]);
}
