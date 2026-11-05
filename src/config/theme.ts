import { ROLE_META, topRole, type Role } from "./roles";

/** As 10 cores que cada pessoa pode escolher. */
export const ACCENTS = [
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
] as const;

/** Amarelo e vermelho são reservados aos cargos Gestor e Adm: ninguém os escolhe. */
export const CHOOSABLE_ACCENTS = ACCENTS.filter((a) => a.key !== "amarelo" && a.key !== "vermelho");

export type AccentKey = (typeof ACCENTS)[number]["key"];

export function isAccentKey(value: string | null | undefined): value is AccentKey {
  return ACCENTS.some((a) => a.key === value);
}

/** Cores que uma pessoa pode escolher para si. */
export function isChoosableAccent(value: string | null | undefined): value is AccentKey {
  return CHOOSABLE_ACCENTS.some((a) => a.key === value);
}

/** Cor efetiva: a escolhida pela pessoa ou a padrão do cargo mais alto. */
export function resolveAccent(accent: string | null | undefined, roles: readonly Role[]) {
  const key = isAccentKey(accent) ? accent : ROLE_META[topRole(roles)].defaultAccent;
  const found = ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];
  return { key: found.key, hex: found.hex, onAccent: readableOn(found.hex) };
}

/** Texto preto ou branco, o que contrastar melhor com a cor. */
function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1a1a1a" : "#ffffff";
}

/** Cor da bolha de uma pessoa: a que ela escolheu; sem escolha, uma cor fixa da paleta (nunca amarelo/vermelho, que são dos cargos). */
export function bubbleHex(accent: string | null | undefined, userId: number, roles?: readonly Role[]): string {
  if (roles) return resolveAccent(accent, roles).hex;
  if (isChoosableAccent(accent)) return CHOOSABLE_ACCENTS.find((a) => a.key === accent)!.hex;
  return CHOOSABLE_ACCENTS[userId % CHOOSABLE_ACCENTS.length].hex;
}
