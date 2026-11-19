import type React from "react";
/** Padrões de banner do perfil. Todos usam a cor do sistema da pessoa (--accent / --accent-2), então cada um fica com a cara dela. */
export type Banner = { key: string; label: string; css: Record<string, string> };

const A = "var(--accent)", B = "var(--accent-2, var(--accent))";
const soft = (p: number) => `color-mix(in srgb, #fff ${p}%, transparent)`;
const dark = (p: number) => `color-mix(in srgb, #000 ${p}%, transparent)`;

export const BANNERS: Banner[] = [
  { key: "aurora", label: "Aurora", css: { backgroundImage: `linear-gradient(135deg, ${A}, ${B})` } },
  { key: "dots", label: "Bolinhas", css: { backgroundImage: `radial-gradient(${soft(35)} 2px, transparent 2.5px), linear-gradient(135deg, ${A}, ${B})`, backgroundSize: "16px 16px, auto" } },
  { key: "grid", label: "Quadriculado", css: { backgroundImage: `linear-gradient(${soft(22)} 1px, transparent 1px), linear-gradient(90deg, ${soft(22)} 1px, transparent 1px), linear-gradient(135deg, ${A}, ${B})`, backgroundSize: "22px 22px, 22px 22px, auto" } },
  { key: "stripes", label: "Listras", css: { backgroundImage: `repeating-linear-gradient(45deg, ${soft(16)} 0 12px, transparent 12px 24px), linear-gradient(135deg, ${A}, ${B})` } },
  { key: "waves", label: "Ondas", css: { backgroundImage: `radial-gradient(circle at 50% 120%, transparent 38%, ${soft(22)} 39% 43%, transparent 44%), radial-gradient(circle at 50% -20%, transparent 38%, ${dark(14)} 39% 43%, transparent 44%), linear-gradient(135deg, ${A}, ${B})`, backgroundSize: "56px 28px, 56px 28px, auto" } },
  { key: "rings", label: "Anéis", css: { backgroundImage: `repeating-radial-gradient(circle at 20% 120%, transparent 0 16px, ${soft(20)} 16px 18px), linear-gradient(135deg, ${A}, ${B})` } },
  { key: "topo", label: "Relevo", css: { backgroundImage: `repeating-radial-gradient(ellipse at 75% 30%, transparent 0 9px, ${soft(18)} 9px 10px), linear-gradient(120deg, ${A}, ${B})` } },
  { key: "checks", label: "Xadrez", css: { backgroundImage: `conic-gradient(${soft(14)} 25%, transparent 0 50%, ${soft(14)} 0 75%, transparent 0)`, backgroundSize: "36px 36px", backgroundColor: A } },
  { key: "zigzag", label: "Zigue-zague", css: { backgroundImage: `linear-gradient(135deg, ${soft(18)} 25%, transparent 25%), linear-gradient(225deg, ${soft(18)} 25%, transparent 25%), linear-gradient(45deg, ${soft(18)} 25%, transparent 25%), linear-gradient(315deg, ${soft(18)} 25%, transparent 25%)`, backgroundSize: "28px 28px", backgroundPosition: "14px 0, 14px 0, 0 0, 0 0", backgroundColor: A } },
  { key: "diamonds", label: "Mosaico", css: { backgroundImage: `linear-gradient(45deg, ${dark(12)} 25%, transparent 25% 75%, ${dark(12)} 75%), linear-gradient(45deg, ${dark(12)} 25%, transparent 25% 75%, ${dark(12)} 75%), linear-gradient(135deg, ${A}, ${B})`, backgroundSize: "32px 32px, 32px 32px, auto", backgroundPosition: "0 0, 16px 16px, 0 0" } },
  { key: "mesh", label: "Malha", css: { backgroundImage: `radial-gradient(at 15% 20%, ${soft(40)}, transparent 45%), radial-gradient(at 85% 30%, ${B}, transparent 50%), radial-gradient(at 50% 110%, ${dark(30)}, transparent 55%)`, backgroundColor: A } },
  { key: "spotlight", label: "Holofote", css: { backgroundImage: `radial-gradient(circle at 30% 0%, ${soft(45)}, transparent 55%), linear-gradient(160deg, ${A}, ${dark(35)} 140%)` } },
  { key: "night", label: "Noite", css: { backgroundImage: `radial-gradient(${soft(70)} 1px, transparent 1.5px), radial-gradient(${soft(45)} 1px, transparent 1.5px), linear-gradient(160deg, #0b1020, color-mix(in srgb, ${A} 55%, #0b1020))`, backgroundSize: "46px 46px, 71px 71px, auto", backgroundPosition: "0 0, 23px 31px, 0 0" } },
  { key: "solid", label: "Liso", css: { backgroundColor: A } },
];
export const BANNER_BY_KEY = new Map(BANNERS.map((b) => [b.key, b]));
export const bannerStyle = (key?: string | null): React.CSSProperties => (BANNER_BY_KEY.get(key ?? "") ?? BANNERS[0]).css as React.CSSProperties;
