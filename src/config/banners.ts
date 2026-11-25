import type React from "react";
import { SHOP_BY_KEY } from "@/config/shop";
/** Padrões de banner do perfil. Todos usam a cor do sistema da pessoa (--accent / --accent-2), então cada um fica com a cara dela. */
export type Banner = { key: string; label: string; css: Record<string, string>; /** Chave da conquista que libera este padrão (sem ela, é livre para todos). */ unlock?: string };

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
  /* Liberados por conquistas: a raridade é a da conquista (config/achievements.ts). */
  { key: "sunrise", label: "Amanhecer", unlock: "early_20", css: { backgroundImage: `linear-gradient(180deg, #fde68a, #fb923c 55%, ${A} 130%)` } },
  { key: "dusk", label: "Entardecer", unlock: "late_20", css: { backgroundImage: `radial-gradient(circle at 80% 110%, #fb923c, transparent 45%), linear-gradient(180deg, #1e1b4b, #7c3aed 70%, #f472b6)` } },
  { key: "ruled", label: "Caderno", unlock: "att_25", css: { backgroundImage: `repeating-linear-gradient(180deg, transparent 0 15px, ${soft(26)} 15px 16px), linear-gradient(90deg, transparent 22px, #f8717199 22px 24px, transparent 24px), linear-gradient(135deg, ${A}, ${B})` } },
  { key: "carbon", label: "Fibra de carbono", unlock: "call_500", css: { backgroundImage: `linear-gradient(45deg, #000 25%, transparent 25% 75%, #000 75%), linear-gradient(45deg, #000 25%, transparent 25% 75%, #000 75%), linear-gradient(135deg, #1f2937, color-mix(in srgb, ${A} 30%, #111827))`, backgroundSize: "10px 10px, 10px 10px, auto", backgroundPosition: "0 0, 5px 5px, 0 0" } },
  { key: "blueprint", label: "Projeto", unlock: "deal_25", css: { backgroundImage: `linear-gradient(${soft(30)} 1px, transparent 1px), linear-gradient(90deg, ${soft(30)} 1px, transparent 1px), linear-gradient(135deg, #1d4ed8, #0b3a8f)`, backgroundSize: "14px 14px, 14px 14px, auto" } },
  { key: "hazard", label: "Faixa de oficina", unlock: "sched_25", css: { backgroundImage: `repeating-linear-gradient(-45deg, #facc15 0 14px, #1f2937 14px 28px)` } },
  { key: "ember", label: "Brasa", unlock: "day_50", css: { backgroundImage: `radial-gradient(circle at 20% 120%, #fde047, transparent 40%), radial-gradient(circle at 80% 130%, #fb923c, transparent 45%), radial-gradient(${soft(55)} 1.5px, transparent 2px), linear-gradient(180deg, #450a0a, #b91c1c 70%, #f97316)`, backgroundSize: "auto, auto, 34px 34px, auto" } },
  { key: "boreal", label: "Aurora boreal", unlock: "acc_365", css: { backgroundImage: `radial-gradient(ellipse at 20% 30%, #34d39988, transparent 50%), radial-gradient(ellipse at 70% 20%, #60a5fa88, transparent 50%), radial-gradient(ellipse at 50% 80%, #c084fc77, transparent 55%), linear-gradient(180deg, #0b1020, #0f2a3a)` } },
  { key: "neon", label: "Neon", unlock: "conv_50", css: { backgroundImage: `linear-gradient(${A} 1px, transparent 1px), linear-gradient(90deg, ${A} 1px, transparent 1px), radial-gradient(circle at 50% 120%, color-mix(in srgb, ${A} 55%, transparent), transparent 60%)`, backgroundColor: "#070712", backgroundSize: "24px 24px, 24px 24px, auto" } },
  { key: "galaxy", label: "Galáxia", unlock: "att_5000", css: { backgroundImage: `radial-gradient(#fff 1px, transparent 1.5px), radial-gradient(#fff9 1px, transparent 1.5px), radial-gradient(ellipse at 30% 40%, #a855f7aa, transparent 55%), radial-gradient(ellipse at 75% 60%, #22d3eeaa, transparent 55%)`, backgroundColor: "#05010f", backgroundSize: "37px 37px, 61px 61px, auto, auto", backgroundPosition: "0 0, 17px 23px, 0 0, 0 0" } },
  { key: "holo", label: "Holográfico", unlock: "bill_200", css: { backgroundImage: `repeating-linear-gradient(115deg, #ff9ad5aa 0 12px, #fff3a8aa 12px 24px, #9affd6aa 24px 36px, #9ad0ffaa 36px 48px, #d3a8ffaa 48px 60px), linear-gradient(135deg, #f5f3ff, #e0f2fe)` } },
  { key: "ouro", label: "Ouro maciço", unlock: "cash_1m", css: { backgroundImage: `linear-gradient(115deg, transparent 30%, #fff8 45%, transparent 60%), linear-gradient(135deg, #92400e, #f59e0b 30%, #fde68a 50%, #f59e0b 70%, #92400e)` } },
  { key: "douradovo", label: "Douradovo", unlock: "egg", css: { backgroundImage: `radial-gradient(circle at 50% 50%, #fff7c2, transparent 45%), radial-gradient(${soft(60)} 1.5px, transparent 2px), linear-gradient(135deg, #d97706, #fbbf24 50%, #b45309)`, backgroundSize: "auto, 28px 28px, auto" } },
];
export const BANNER_BY_KEY = new Map(BANNERS.map((b) => [b.key, b]));
/** Banner livre ou liberado? `earned` = chaves das conquistas que a pessoa tem. */
export const bannerOpen = (b: Banner, earned: ReadonlySet<string> | readonly string[]) => !b.unlock || (Array.isArray(earned) ? earned.includes(b.unlock) : (earned as ReadonlySet<string>).has(b.unlock));
/** Os banners da loja do chat (chave "banner_…") também valem como banner de perfil. */
export const bannerStyle = (key?: string | null): React.CSSProperties => (BANNER_BY_KEY.get(key ?? "")?.css ?? SHOP_BY_KEY.get(key ?? "")?.css ?? BANNERS[0].css) as React.CSSProperties;
