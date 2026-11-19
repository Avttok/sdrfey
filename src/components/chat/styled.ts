import type { CSSProperties } from "react";
import { SHOP_BY_KEY } from "@/config/shop";

/** Estilo do nome e do balão de quem enviou, a partir dos itens vestidos ({ font, color, effect, bubble }). */
export function chatStyle(eq: Record<string, string> | undefined): { name: CSSProperties; nameCls: string; bubble: CSSProperties | null } {
  const get = (c: string) => (eq?.[c] ? SHOP_BY_KEY.get(eq[c]) : undefined);
  const name: Record<string, string> = { ...get("font")?.css, ...get("color")?.css, ...get("effect")?.css };
  const col = get("color")?.css;
  // base do efeito: cor lisa ou degradê escolhido (o brilho/reluzente precisam saber de que cor partir)
  if (col) { name["--fx"] = col.color && col.color !== "transparent" ? col.color : "#fbbf24"; name["--nm"] = col.backgroundImage ?? `linear-gradient(${col.color}, ${col.color})`; }
  const b = get("bubble");
  return { name: name as CSSProperties, nameCls: get("effect")?.cls ?? "", bubble: b ? ({ border: "1px solid", ...b.css } as CSSProperties) : null };
}
