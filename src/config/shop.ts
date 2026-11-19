/** Catálogo da loja do chat. Tudo é visual: nome (fonte, cor, efeito) e balão de texto. */
export type ShopCategory = "font" | "color" | "effect" | "bubble";
export type ShopItem = { key: string; cat: ShopCategory; name: string; price: number; /** CSS aplicado (nome ou balão) */ css: Record<string, string>; /** classe de animação opcional */ cls?: string };

export const CATEGORIES: { key: ShopCategory; label: string; hint: string }[] = [
  { key: "font", label: "Fonte do nome", hint: "O jeito que seu nome é escrito" },
  { key: "color", label: "Cor do nome", hint: "Cores lisas e degradês" },
  { key: "effect", label: "Efeito do nome", hint: "Brilho e animação" },
  { key: "bubble", label: "Balão de texto", hint: "O fundo das suas mensagens" },
];

const font = (key: string, name: string, price: number, family: string, extra: Record<string, string> = {}): ShopItem => ({ key: `font_${key}`, cat: "font", name, price, css: { fontFamily: family, ...extra } });
const color = (key: string, name: string, price: number, c: string): ShopItem => ({ key: `color_${key}`, cat: "color", name, price, css: { color: c } });
const grad = (key: string, name: string, price: number, g: string): ShopItem => ({ key: `color_${key}`, cat: "color", name, price, css: { backgroundImage: g, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" } });
const effect = (key: string, name: string, price: number, cls: string, css: Record<string, string> = {}): ShopItem => ({ key: `fx_${key}`, cat: "effect", name, price, cls, css });
const bubble = (key: string, name: string, price: number, css: Record<string, string>): ShopItem => ({ key: `bubble_${key}`, cat: "bubble", name, price, css });

export const SHOP: ShopItem[] = [
  font("serif", "Clássica", 40, "Georgia, 'Times New Roman', serif", { fontWeight: "700" }),
  font("mono", "Código", 40, "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", { fontWeight: "700" }),
  font("cursive", "Manuscrita", 60, "'Brush Script MT', 'Segoe Script', cursive", { fontSize: "1.15em" }),
  font("impact", "Impacto", 60, "Impact, 'Arial Narrow Bold', sans-serif", { letterSpacing: ".03em" }),
  font("spaced", "Espaçada", 80, "system-ui, sans-serif", { letterSpacing: ".18em", textTransform: "uppercase", fontSize: ".85em", fontWeight: "700" }),
  font("fantasy", "Aventura", 120, "fantasy, Papyrus, serif", { fontSize: "1.1em" }),

  color("red", "Vermelho", 30, "#ef4444"), color("blue", "Azul", 30, "#3b82f6"), color("green", "Verde", 30, "#22c55e"),
  color("pink", "Rosa", 30, "#ec4899"), color("orange", "Laranja", 30, "#f97316"), color("purple", "Roxo", 30, "#a855f7"),
  grad("gold", "Ouro", 150, "linear-gradient(90deg,#f59e0b,#fde68a,#d97706)"),
  grad("ocean", "Oceano", 120, "linear-gradient(90deg,#06b6d4,#3b82f6,#6366f1)"),
  grad("sunset", "Pôr do sol", 120, "linear-gradient(90deg,#f97316,#ec4899,#a855f7)"),
  grad("rainbow", "Arco-íris", 200, "linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7)"),

  effect("glow", "Brilho", 100, "fx-glow"),
  effect("neon", "Neon", 160, "fx-neon"),
  effect("shimmer", "Reluzente", 200, "fx-shimmer"),
  effect("pulse", "Pulsar", 140, "fx-pulse"),
  effect("wave", "Ondulante", 180, "fx-wave"),
  effect("rgb", "Ciclo de cores", 300, "fx-rgb"),

  bubble("soft", "Pastel", 50, { background: "color-mix(in srgb, #a78bfa 22%, var(--panel))", borderColor: "color-mix(in srgb, #a78bfa 45%, transparent)" }),
  bubble("mint", "Menta", 50, { background: "color-mix(in srgb, #34d399 22%, var(--panel))", borderColor: "color-mix(in srgb, #34d399 45%, transparent)" }),
  bubble("peach", "Pêssego", 50, { background: "color-mix(in srgb, #fb923c 22%, var(--panel))", borderColor: "color-mix(in srgb, #fb923c 45%, transparent)" }),
  bubble("dark", "Noite", 90, { background: "#111827", color: "#f9fafb", borderColor: "#374151" }),
  bubble("glass", "Vidro", 110, { background: "color-mix(in srgb, var(--panel) 55%, transparent)", backdropFilter: "blur(8px)", borderColor: "color-mix(in srgb, var(--ink) 25%, transparent)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }),
  bubble("neon", "Neon", 180, { background: "#0b0b14", color: "#e9d5ff", borderColor: "#a855f7", boxShadow: "0 0 0 1px #a855f7, 0 0 16px #a855f7aa" }),
  bubble("gold", "Dourado", 250, { background: "linear-gradient(135deg,#fde68a,#f59e0b)", color: "#451a03", borderColor: "#b45309" }),
  bubble("aurora", "Aurora", 300, { background: "linear-gradient(135deg,#22d3ee,#818cf8,#e879f9)", color: "#fff", borderColor: "transparent", boxShadow: "0 6px 20px #818cf855" }),
];
export const SHOP_BY_KEY = new Map(SHOP.map((i) => [i.key, i]));

/** Moedas ganhas por tarefa (a cada feito, uma vez). */
export const TASK_COINS = { attended: 1, visit: 5, deal: 8, quote: 3, billed: 25, shuffled: 1 } as const;
/** Moedas por conquista: pela dificuldade (meta da conquista). */
export const achievementCoins = (goal: number) => (goal >= 1000 ? 150 : goal >= 100 ? 75 : goal >= 20 ? 40 : 20);
