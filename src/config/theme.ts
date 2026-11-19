import { ROLE_META, topRole, type Role } from "./roles";

export type Accent = { key: string; label: string; hex: string; /** Segunda cor: temas com degradê. */ hex2?: string };

/** Cores sólidas e degradês que cada pessoa pode escolher. */
export const ACCENTS: readonly Accent[] = [
  { key: "azul", label: "Azul", hex: "#3b82f6" },
  { key: "amarelo", label: "Amarelo", hex: "#eab308" },
  { key: "vermelho", label: "Vermelho", hex: "#ef4444" },
  { key: "verde", label: "Verde", hex: "#22c55e" },
  { key: "roxo", label: "Roxo", hex: "#8b5cf6" },
  { key: "rosa", label: "Rosa", hex: "#ec4899" },
  { key: "laranja", label: "Laranja", hex: "#f97316" },
  { key: "ciano", label: "Ciano", hex: "#06b6d4" },
  { key: "indigo", label: "Índigo", hex: "#6366f1" },
  { key: "grafite", label: "Grafite", hex: "#64748b" },
  { key: "lima", label: "Lima", hex: "#84cc16" },
  { key: "turquesa", label: "Turquesa", hex: "#14b8a6" },
  { key: "esmeralda", label: "Esmeralda", hex: "#10b981" },
  { key: "magenta", label: "Magenta", hex: "#d946ef" },
  { key: "marinho", label: "Marinho", hex: "#1d4ed8" },
  { key: "aurora", label: "Aurora", hex: "#3b82f6", hex2: "#8b5cf6" },
  { key: "sunset", label: "Pôr do sol", hex: "#f97316", hex2: "#ec4899" },
  { key: "oceano", label: "Oceano", hex: "#06b6d4", hex2: "#2563eb" },
  { key: "floresta", label: "Floresta", hex: "#22c55e", hex2: "#0d9488" },
  { key: "lavanda", label: "Lavanda", hex: "#8b5cf6", hex2: "#ec4899" },
  { key: "neon", label: "Neon", hex: "#84cc16", hex2: "#06b6d4" },
  { key: "noite", label: "Meia-noite", hex: "#4f46e5", hex2: "#a855f7" },
  { key: "tropical", label: "Tropical", hex: "#14b8a6", hex2: "#84cc16" },
  { key: "coral", label: "Coral", hex: "#fb7185" },
  { key: "violeta", label: "Violeta", hex: "#7c3aed" },
  { key: "petroleo", label: "Petróleo", hex: "#0e7490" },
  { key: "ameixa", label: "Ameixa", hex: "#86198f" },
  { key: "menta", label: "Menta", hex: "#34d399" },
  { key: "ceu", label: "Céu", hex: "#38bdf8" },
  { key: "oliva", label: "Oliva", hex: "#4d7c0f" },
  { key: "terra", label: "Terra", hex: "#b45309" },
  { key: "algodao", label: "Algodão-doce", hex: "#f472b6", hex2: "#818cf8" },
  { key: "gelo", label: "Gelo", hex: "#67e8f9", hex2: "#a5b4fc" },
  { key: "vulcao", label: "Vulcão", hex: "#f97316", hex2: "#be185d" },
  { key: "galaxia", label: "Galáxia", hex: "#1e3a8a", hex2: "#a21caf" },
  { key: "framboesa", label: "Framboesa", hex: "#db2777", hex2: "#7c3aed" },
  { key: "jade", label: "Jade", hex: "#059669", hex2: "#0891b2" },
  { key: "cobre", label: "Cobre", hex: "#ea580c", hex2: "#9333ea" },
  { key: "titanio", label: "Titânio", hex: "#475569", hex2: "#94a3b8" },
  { key: "boreal", label: "Aurora boreal", hex: "#10b981", hex2: "#6366f1" },
  { key: "pessego", label: "Pêssego", hex: "#fb923c", hex2: "#f472b6" },
  { key: "mar", label: "Mar profundo", hex: "#0ea5e9", hex2: "#4f46e5" },
  { key: "maresia", label: "Maresia", hex: "#2dd4bf", hex2: "#38bdf8" },
];

/** Fundo da bolinha de uma cor: sólido ou degradê. */
export const swatchBg = (a: { hex: string; hex2?: string }) => (a.hex2 ? `linear-gradient(135deg, ${a.hex}, ${a.hex2})` : a.hex);

/** Amarelo e vermelho são reservados aos cargos Gestor e Adm: ninguém os escolhe. */
export const CHOOSABLE_ACCENTS = ACCENTS.filter((a) => a.key !== "amarelo" && a.key !== "vermelho");

/** Atalhos do menu do perfil (o resto fica em Minha conta). */
export const QUICK_ACCENTS = ["azul", "verde", "roxo", "rosa", "aurora", "sunset"];

export type AccentKey = string;

export function isAccentKey(value: string | null | undefined): value is AccentKey {
  return ACCENTS.some((a) => a.key === value);
}

/** Cores que uma pessoa pode escolher para si. */
export function isChoosableAccent(value: string | null | undefined): value is AccentKey {
  return CHOOSABLE_ACCENTS.some((a) => a.key === value);
}

/** Cor efetiva: a escolhida pela pessoa ou a padrão do cargo mais alto. */
export function resolveAccent(accent: string | null | undefined, roles: readonly Role[]) {
  const key = isAccentKey(accent) ? accent : ROLE_META[topRole(roles.filter((r) => r !== "admin").length ? roles.filter((r) => r !== "admin") : roles)].defaultAccent;
  const found = ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];
  return { key: found.key, hex: found.hex, hex2: found.hex2 ?? null, onAccent: readableOn(found.hex, found.hex2) };
}

/** Texto preto ou branco, o que contrastar melhor com a cor. */
function readableOn(hex: string, hex2?: string): string {
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const luminance = hex2 ? (lum(hex) + lum(hex2)) / 2 : lum(hex);
  return luminance > 0.62 ? "#1a1a1a" : "#ffffff";
}

/** Cor da bolha de uma pessoa: a que ela escolheu; sem escolha, uma cor fixa da paleta (nunca amarelo/vermelho, que são dos cargos). */
export function bubbleHex(accent: string | null | undefined, userId: number, roles?: readonly Role[]): string {
  if (roles) return resolveAccent(accent, roles).hex;
  if (isChoosableAccent(accent)) return CHOOSABLE_ACCENTS.find((a) => a.key === accent)!.hex;
  return CHOOSABLE_ACCENTS[userId % CHOOSABLE_ACCENTS.length].hex;
}
