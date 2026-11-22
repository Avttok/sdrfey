import { Cat, Coffee, Flame, Heart, Rocket, Smile, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";

/** Cores e adesivos do post-it do mural "Estive aqui". Guardamos só a chave no banco. */
export const NOTE_COLORS = [
  { key: "amarelo", label: "Amarelo", bg: "#fde68a", edge: "#f5c542", ink: "#4a3a00" },
  { key: "rosa", label: "Rosa", bg: "#fbcfe8", edge: "#f472b6", ink: "#5b1235" },
  { key: "azul", label: "Azul", bg: "#bfdbfe", edge: "#60a5fa", ink: "#10315e" },
  { key: "verde", label: "Verde", bg: "#bbf7d0", edge: "#34d399", ink: "#0b4226" },
  { key: "laranja", label: "Laranja", bg: "#fed7aa", edge: "#fb923c", ink: "#5a2a05" },
  { key: "lilas", label: "Lilás", bg: "#e9d5ff", edge: "#c084fc", ink: "#3b1566" },
] as const;
export const NOTE_STICKERS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "estrela", label: "Estrela", icon: Star }, { key: "coracao", label: "Coração", icon: Heart }, { key: "raio", label: "Raio", icon: Zap },
  { key: "foguete", label: "Foguete", icon: Rocket }, { key: "fogo", label: "Fogo", icon: Flame }, { key: "sorriso", label: "Sorriso", icon: Smile },
  { key: "gato", label: "Gato", icon: Cat }, { key: "cafe", label: "Café", icon: Coffee }, { key: "brilho", label: "Brilho", icon: Sparkles },
];
export const NOTE_MAX = 100;
export const noteColor = (k: string) => NOTE_COLORS.find((c) => c.key === k) ?? NOTE_COLORS[0];
export const noteSticker = (k: string) => NOTE_STICKERS.find((s) => s.key === k) ?? NOTE_STICKERS[0];
