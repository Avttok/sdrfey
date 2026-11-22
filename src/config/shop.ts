/** Catálogo da loja do chat. Tudo é visual: nome (fonte, cor, efeito) e balão de texto. */
export type ShopCategory = "font" | "color" | "effect" | "bubble";
export type ShopItem = { key: string; cat: ShopCategory; name: string; price: number; /** CSS aplicado (nome ou balão) */ css: Record<string, string>; /** classe de animação opcional */ cls?: string; /** só se ganha em segredo: some da vitrine enquanto não for seu */ secret?: boolean };

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
  /* ───── Fontes ───── */
  font("manrope", "Moderna", 25, '"Manrope Variable", system-ui, sans-serif', { fontWeight: "800" }),
  font("grotesk", "Técnica", 25, '"Space Grotesk Variable", system-ui, sans-serif', { fontWeight: "700" }),
  font("lexend", "Leve", 25, '"Lexend Variable", system-ui, sans-serif', { fontWeight: "600" }),
  font("serif", "Clássica", 40, "Georgia, 'Times New Roman', serif", { fontWeight: "700" }),
  font("book", "Livro", 40, "Palatino, 'Palatino Linotype', 'Book Antiqua', serif", { fontWeight: "700", fontStyle: "italic" }),
  font("mono", "Código", 40, "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", { fontWeight: "700" }),
  font("typewriter", "Máquina de escrever", 50, "'Courier New', Courier, monospace", { fontWeight: "700", letterSpacing: ".02em" }),
  font("rounded", "Arredondada", 50, "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Trebuchet MS', sans-serif", { fontWeight: "800" }),
  font("humanist", "Humanista", 50, "'Trebuchet MS', 'Gill Sans', sans-serif", { fontWeight: "700" }),
  font("wide", "Larga", 60, "Verdana, Geneva, sans-serif", { fontWeight: "700", letterSpacing: ".04em" }),
  font("condensed", "Condensada", 60, "'Arial Narrow', 'Roboto Condensed', Impact, sans-serif", { fontWeight: "700", letterSpacing: ".02em" }),
  font("smallcaps", "Versalete", 70, "Georgia, serif", { fontVariant: "small-caps", fontWeight: "700", letterSpacing: ".06em" }),
  font("cursive", "Manuscrita", 80, "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive", { fontSize: "1.15em" }),
  font("impact", "Impacto", 80, "Impact, 'Arial Narrow Bold', sans-serif", { letterSpacing: ".03em" }),
  font("spaced", "Espaçada", 100, "system-ui, sans-serif", { letterSpacing: ".18em", textTransform: "uppercase", fontSize: ".85em", fontWeight: "700" }),
  font("slab", "Placa", 110, "Rockwell, 'Roboto Slab', 'Courier New', serif", { fontWeight: "800" }),
  font("fantasy", "Aventura", 140, "fantasy, Papyrus, serif", { fontSize: "1.1em" }),
  font("retro", "Retrô", 160, "'Arial Black', 'Helvetica Neue', sans-serif", { fontWeight: "900", textTransform: "uppercase", letterSpacing: ".04em", fontSize: ".9em" }),

  /* ───── Cores lisas ───── */
  color("slate", "Grafite", 20, "#64748b"), color("red", "Vermelho", 30, "#ef4444"), color("coral", "Coral", 30, "#fb7185"),
  color("orange", "Laranja", 30, "#f97316"), color("amber", "Âmbar", 30, "#f59e0b"), color("lime", "Limão", 30, "#84cc16"),
  color("green", "Verde", 30, "#22c55e"), color("mint", "Menta", 30, "#2dd4bf"), color("teal", "Petróleo", 30, "#0d9488"),
  color("sky", "Céu", 30, "#38bdf8"), color("blue", "Azul", 30, "#3b82f6"), color("indigo", "Índigo", 30, "#6366f1"),
  color("purple", "Roxo", 30, "#a855f7"), color("lavender", "Lavanda", 30, "#a78bfa"), color("pink", "Rosa", 30, "#ec4899"),
  color("brown", "Chocolate", 30, "#a16207"),

  /* ───── Degradês ───── */
  grad("peach", "Pêssego", 90, "linear-gradient(90deg,#fb923c,#f472b6)"),
  grad("ice", "Gelo", 90, "linear-gradient(90deg,#67e8f9,#a5b4fc)"),
  grad("forest", "Floresta", 100, "linear-gradient(90deg,#16a34a,#a3e635)"),
  grad("candy", "Algodão-doce", 100, "linear-gradient(90deg,#f472b6,#c084fc,#60a5fa)"),
  grad("lava", "Lava", 110, "linear-gradient(90deg,#dc2626,#f97316,#facc15)"),
  grad("ocean", "Oceano", 120, "linear-gradient(90deg,#06b6d4,#3b82f6,#6366f1)"),
  grad("sunset", "Pôr do sol", 120, "linear-gradient(90deg,#f97316,#ec4899,#a855f7)"),
  grad("midnight", "Meia-noite", 130, "linear-gradient(90deg,#818cf8,#c084fc,#f0abfc)"),
  grad("aurora", "Aurora boreal", 150, "linear-gradient(90deg,#34d399,#22d3ee,#a78bfa)"),
  grad("gold", "Ouro", 150, "linear-gradient(90deg,#f59e0b,#fde68a,#d97706)"),
  grad("silver", "Prata", 150, "linear-gradient(90deg,#94a3b8,#f1f5f9,#64748b)"),
  grad("rainbow", "Arco-íris", 200, "linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7)"),

  /* ───── Efeitos (discretos primeiro) ───── */
  effect("soft", "Sombra suave", 60, "fx-soft"),
  effect("emboss", "Relevo", 70, "fx-emboss"),
  effect("outline", "Contorno", 70, "fx-outline"),
  effect("wavy", "Sublinhado ondulado", 80, "fx-wavy"),
  effect("mark", "Marca-texto", 80, "fx-mark"),
  effect("hover", "Brilho ao passar o mouse", 90, "fx-hover"),
  effect("glow", "Brilho", 100, "fx-glow"),
  effect("breathe", "Respirar", 110, "fx-breathe"),
  effect("star", "Estrelinha", 120, "fx-star"),
  effect("sparkle", "Cintilar", 130, "fx-sparkle"),
  effect("heart", "Coração", 130, "fx-heart"),
  effect("bolt", "Raio", 140, "fx-bolt"),
  effect("pulse", "Pulsar", 140, "fx-pulse"),
  effect("neon", "Neon", 160, "fx-neon"),
  effect("wave", "Ondulante", 180, "fx-wave"),
  effect("shimmer", "Reluzente", 200, "fx-shimmer"),
  effect("crown", "Coroa", 260, "fx-crown"),
  effect("rgb", "Ciclo de cores", 300, "fx-rgb"),
  effect("flame", "Chama", 150, "fx-flame"),
  effect("frost", "Gelo cintilante", 150, "fx-frost"),
  effect("glitch", "Falha digital", 170, "fx-glitch"),
  effect("float", "Flutuar", 120, "fx-float"),
  effect("rocket", "Foguete", 140, "fx-rocket"),
  effect("coin", "Moedinha", 130, "fx-coin"),
  effect("underline", "Sublinhado animado", 110, "fx-underline"),
  effect("aura", "Aura", 220, "fx-aura"),

  /* ───── Balões ───── */
  bubble("paper", "Papel", 40, { background: "#fbf7ee", color: "#3b2f1d", borderColor: "#e6dcc3" }),
  bubble("soft", "Lilás", 50, { background: "color-mix(in srgb, #a78bfa 22%, var(--panel))", borderColor: "color-mix(in srgb, #a78bfa 45%, transparent)" }),
  bubble("mint", "Menta", 50, { background: "color-mix(in srgb, #34d399 22%, var(--panel))", borderColor: "color-mix(in srgb, #34d399 45%, transparent)" }),
  bubble("peach", "Pêssego", 50, { background: "color-mix(in srgb, #fb923c 22%, var(--panel))", borderColor: "color-mix(in srgb, #fb923c 45%, transparent)" }),
  bubble("rose", "Rosa", 50, { background: "color-mix(in srgb, #f472b6 22%, var(--panel))", borderColor: "color-mix(in srgb, #f472b6 45%, transparent)" }),
  bubble("sky", "Céu", 50, { background: "color-mix(in srgb, #38bdf8 22%, var(--panel))", borderColor: "color-mix(in srgb, #38bdf8 45%, transparent)" }),
  bubble("lemon", "Limão", 50, { background: "color-mix(in srgb, #facc15 26%, var(--panel))", borderColor: "color-mix(in srgb, #facc15 50%, transparent)" }),
  bubble("outline", "Só contorno", 70, { background: "transparent", borderColor: "var(--accent)", borderWidth: "2px" }),
  bubble("dashed", "Tracejado", 70, { background: "transparent", borderColor: "color-mix(in srgb, var(--ink) 45%, transparent)", borderStyle: "dashed" }),
  bubble("graphite", "Grafite", 80, { background: "#334155", color: "#f1f5f9", borderColor: "#475569" }),
  bubble("dark", "Noite", 90, { background: "#111827", color: "#f9fafb", borderColor: "#374151" }),
  bubble("dots", "Bolinhas", 100, { backgroundColor: "color-mix(in srgb, #f472b6 16%, var(--panel))", backgroundImage: "radial-gradient(color-mix(in srgb, #f472b6 40%, transparent) 1.5px, transparent 1.5px)", backgroundSize: "10px 10px", borderColor: "color-mix(in srgb, #f472b6 45%, transparent)" }),
  bubble("grid", "Quadriculado", 100, { backgroundColor: "color-mix(in srgb, #38bdf8 12%, var(--panel))", backgroundImage: "linear-gradient(color-mix(in srgb, #38bdf8 28%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, #38bdf8 28%, transparent) 1px, transparent 1px)", backgroundSize: "12px 12px", borderColor: "color-mix(in srgb, #38bdf8 45%, transparent)" }),
  bubble("stripes", "Listras", 100, { backgroundColor: "color-mix(in srgb, #34d399 14%, var(--panel))", backgroundImage: "repeating-linear-gradient(45deg, transparent 0 8px, color-mix(in srgb, #34d399 18%, transparent) 8px 16px)", borderColor: "color-mix(in srgb, #34d399 45%, transparent)" }),
  bubble("glass", "Vidro", 110, { background: "color-mix(in srgb, var(--panel) 55%, transparent)", backdropFilter: "blur(8px)", borderColor: "color-mix(in srgb, var(--ink) 25%, transparent)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }),
  bubble("sunset", "Entardecer", 120, { background: "linear-gradient(135deg,#fdba74,#f9a8d4)", color: "#4a1d2f", borderColor: "transparent" }),
  bubble("ocean", "Maré", 120, { background: "linear-gradient(135deg,#67e8f9,#93c5fd)", color: "#0c2a4a", borderColor: "transparent" }),
  bubble("forest", "Mata", 120, { background: "linear-gradient(135deg,#86efac,#bef264)", color: "#14351c", borderColor: "transparent" }),
  bubble("brutal", "Cartaz", 140, { background: "#fef08a", color: "#111", borderColor: "#111", borderWidth: "2px", boxShadow: "3px 3px 0 #111" }),
  bubble("terminal", "Terminal", 150, { background: "#06140a", color: "#86efac", borderColor: "#166534", fontFamily: "ui-monospace, Menlo, Consolas, monospace" }),
  bubble("bubblegum", "Chiclete", 160, { background: "linear-gradient(135deg,#f9a8d4,#c4b5fd)", color: "#3b0a45", borderColor: "transparent", boxShadow: "0 4px 14px #c4b5fd88" }),
  bubble("soap", "Bolha de sabão", 190, { background: "linear-gradient(135deg, #bae6fd88, #fbcfe888, #bbf7d088, #e9d5ff88)", backdropFilter: "blur(4px)", borderColor: "#ffffffaa", boxShadow: "inset 0 0 12px #ffffff99, 0 2px 10px #a5b4fc55" }),
  bubble("neon", "Neon", 180, { background: "#0b0b14", color: "#e9d5ff", borderColor: "#a855f7", boxShadow: "0 0 0 1px #a855f7, 0 0 16px #a855f7aa" }),
  bubble("gold", "Dourado", 250, { background: "linear-gradient(135deg,#fde68a,#f59e0b)", color: "#451a03", borderColor: "#b45309" }),
  bubble("candy", "Doce", 60, { background: "linear-gradient(135deg,#fecdd3,#fde68a)", color: "#5b2130", borderColor: "transparent" }),
  bubble("lavaBub", "Lava", 130, { background: "linear-gradient(135deg,#fb923c,#dc2626)", color: "#fff", borderColor: "transparent" }),
  bubble("matrix", "Matrix", 170, { background: "#000", color: "#4ade80", borderColor: "#22c55e", fontFamily: "ui-monospace, Menlo, monospace", boxShadow: "0 0 12px #22c55e66" }),
  bubble("royal", "Realeza", 280, { background: "linear-gradient(135deg,#4c1d95,#7c3aed)", color: "#fde68a", borderColor: "#fbbf24", boxShadow: "0 0 0 1px #fbbf24" }),
  bubble("aurora", "Aurora", 300, { background: "linear-gradient(135deg,#22d3ee,#818cf8,#e879f9)", color: "#fff", borderColor: "transparent", boxShadow: "0 6px 20px #818cf855" }),
];
/** Prêmios do easter egg: um por categoria, não se compram. */
export const EGG_SECRET_ITEMS: ShopItem[] = [
  { key: "font_egg", cat: "font", name: "Douraovo", price: 0, secret: true, css: { fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: "1.15em", fontWeight: "700" } },
  { key: "color_egg", cat: "color", name: "Casca Prismática", price: 0, secret: true, css: { backgroundImage: "linear-gradient(90deg,#fde68a,#f9a8d4,#a5b4fc,#6ee7b7,#fde68a)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" } },
  { key: "fx_egg", cat: "effect", name: "Choco Cósmico", price: 0, secret: true, cls: "fx-egg", css: {} },
  { key: "bubble_egg", cat: "bubble", name: "Casca de Ovo", price: 0, secret: true, css: { background: "linear-gradient(135deg,#fffbeb,#fde68a 60%,#fbbf24)", color: "#451a03", borderColor: "#f59e0b", boxShadow: "0 0 0 1px #f59e0b, 0 0 18px #fbbf2466" } },
];
SHOP.push(...EGG_SECRET_ITEMS);
export const SHOP_BY_KEY = new Map(SHOP.map((i) => [i.key, i]));

/** Moedas ganhas por tarefa (a cada feito, uma vez). */
export const TASK_COINS = { attended: 1, visit: 5, deal: 8, quote: 3, billed: 25, shuffled: 1 } as const;
/** Moedas por conquista: pela dificuldade (meta da conquista). */
export const achievementCoins = (goal: number) => (goal >= 1000 ? 150 : goal >= 100 ? 75 : goal >= 20 ? 40 : 20);
