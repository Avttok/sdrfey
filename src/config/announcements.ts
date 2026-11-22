import { AlertOctagon, AlertTriangle, Info, PartyPopper, Sparkles, type LucideIcon } from "lucide-react";

export type AnnTheme = "urgente" | "atencao" | "aviso" | "sucesso" | "novidade";
export type AnnEffect = "auto" | "none" | "pulse" | "shake" | "shine";
export const ANN_THEMES: Record<AnnTheme, { label: string; hint: string; color: string; icon: LucideIcon; effect: Exclude<AnnEffect, "auto"> }> = {
  urgente: { label: "Urgente", hint: "Vermelho, treme ao chegar", color: "#ef4444", icon: AlertOctagon, effect: "shake" },
  atencao: { label: "Atenção", hint: "Amarelo, pulsa", color: "#f59e0b", icon: AlertTriangle, effect: "pulse" },
  aviso: { label: "Aviso", hint: "Azul, discreto", color: "#3b82f6", icon: Info, effect: "none" },
  sucesso: { label: "Boa notícia", hint: "Verde, brilha", color: "#22c55e", icon: PartyPopper, effect: "shine" },
  novidade: { label: "Novidade", hint: "Roxo, brilha", color: "#8b5cf6", icon: Sparkles, effect: "shine" },
};
export const ANN_EFFECTS: Record<Exclude<AnnEffect, "auto">, string> = { none: "Nenhum", pulse: "Pulsar", shake: "Tremer", shine: "Brilho" };
export type AnnView = { id: number; title: string; body: string; theme: AnnTheme; effect: Exclude<AnnEffect, "auto"> };
export const effectOf = (theme: AnnTheme, effect: AnnEffect): Exclude<AnnEffect, "auto"> => (effect === "auto" ? ANN_THEMES[theme].effect : effect);
