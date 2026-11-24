import type { ScriptGoal } from "@/config/scripts";

/**
 * Objetivos da ligação, escolhidos antes de começar o roteiro. Cada objetivo vira um script (categoria) e, nos pontos em que a conversa
 * se divide, um caminho próprio (a resposta aponta para outro passo conforme o objetivo; veja `goto` nas respostas).
 */
export type ObjectiveId = "agendar" | "qualificar" | "dados" | "visita" | "cotacao" | "fechar" | "retorno" | "fidelizar" | "reativar";
export type ObjectiveArea = "sdr" | "vendas";
export type ObjectiveDef = { label: string; hint: string; goal: ScriptGoal; areas: ObjectiveArea[]; hex: string };

export const OBJECTIVES: Record<ObjectiveId, ObjectiveDef> = {
  agendar: { label: "Agendar visita", hint: "Fazer o lead aceitar uma conversa com o especialista ou a visita do representante", goal: "sdr", areas: ["sdr"], hex: "#8b5cf6" },
  qualificar: { label: "Qualificar lead", hint: "Entender como compra, quanto e quando, e sair sabendo se tem fit", goal: "sdr", areas: ["sdr"], hex: "#0ea5e9" },
  dados: { label: "Confirmar dados", hint: "Atualizar o cadastro: quem compra, WhatsApp, e-mail e melhor horário", goal: "sdr", areas: ["sdr"], hex: "#14b8a6" },
  visita: { label: "Confirmar visita", hint: "Confirmar, lembrar ou remarcar a visita, ou ligar depois dela", goal: "visita", areas: ["sdr"], hex: "#f59e0b" },
  cotacao: { label: "Iniciar cotação", hint: "Descobrir itens e quantidades e deixar a cotação pronta para enviar", goal: "vendas", areas: ["vendas"], hex: "#22c55e" },
  fechar: { label: "Fechar pedido", hint: "Ir direto ao pedido com quem já sabe o que quer", goal: "vendas", areas: ["vendas"], hex: "#16a34a" },
  retorno: { label: "Retomar cotação enviada", hint: "Ligar para quem recebeu a cotação e levar à decisão", goal: "retorno", areas: ["vendas"], hex: "#f97316" },
  fidelizar: { label: "Fidelizar cliente", hint: "Manter o cliente comprando, tirar dúvidas e pedir indicação", goal: "fidelizar", areas: ["vendas"], hex: "#ec4899" },
  reativar: { label: "Reativar cadastro parado", hint: "Retomar o contato com quem tem cadastro e está parado", goal: "reativar", areas: ["sdr", "vendas"], hex: "#64748b" },
};
export const OBJECTIVE_KEYS = Object.keys(OBJECTIVES) as ObjectiveId[];
export const objectivesFor = (area: ObjectiveArea): ObjectiveId[] => OBJECTIVE_KEYS.filter((k) => OBJECTIVES[k].areas.includes(area));
/** Objetivo sugerido para uma categoria de roteiro (o que o sistema escolheria sozinho para este lead). */
export const suggestObjective = (goal: ScriptGoal): ObjectiveId => ({ sdr: "agendar", vendas: "cotacao", retorno: "retorno", fidelizar: "fidelizar", reativar: "reativar", visita: "visita" } as Record<ScriptGoal, ObjectiveId>)[goal];
export const isObjective = (s: string | null | undefined): s is ObjectiveId => !!s && s in OBJECTIVES;
