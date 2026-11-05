/** Fontes que cada pessoa pode escolher em Minha conta. `css` vai direto no font-family. */
export const FONTS = [
  { key: "archivo", label: "Archivo", note: "Padrão do sistema", css: '"Archivo Variable"' },
  { key: "inter", label: "Inter", note: "Neutra e limpa", css: '"Inter Variable"' },
  { key: "manrope", label: "Manrope", note: "Moderna e arredondada", css: '"Manrope Variable"' },
  { key: "grotesk", label: "Space Grotesk", note: "Técnica e marcante", css: '"Space Grotesk Variable"' },
  { key: "lexend", label: "Lexend", note: "Feita para leitura fácil", css: '"Lexend Variable"' },
] as const;

export type FontKey = (typeof FONTS)[number]["key"];

export function isFontKey(v: string | null | undefined): v is FontKey {
  return FONTS.some((f) => f.key === v);
}

export function fontCss(key: string | null | undefined): string {
  const f = FONTS.find((x) => x.key === key) ?? FONTS[0];
  return `${f.css}, ui-sans-serif, system-ui, sans-serif`;
}
