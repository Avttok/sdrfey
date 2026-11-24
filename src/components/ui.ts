/** Classes reutilizáveis. Mude aqui e todos os botões e campos do sistema mudam juntos. */

export const inputCls =
  "min-h-11 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 " +
  "transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export const labelCls = "mb-1.5 block text-sm font-medium text-ink";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-grad px-4 py-2 text-[15px] font-semibold " +
  "text-on-accent transition active:scale-[0.98] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-[15px] font-medium " +
  "text-ink transition-colors hover:bg-sunk";

/** Painel de vidro: translúcido com desfoque leve; o degradê do tema aparece por trás. */
export const panelCls = "rounded-xl border border-line/60 bg-panel/70 bg-grad-panel shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_30px_-16px_rgb(0_0_0/0.18)]";

/**
 * Botões pequenos (linhas de lista, cartões, barras): uma altura só (h-9), cantos e texto iguais em todo o sistema.
 * Use estes em vez de montar classes soltas, para os botões nunca ficarem de tamanhos diferentes lado a lado.
 */
export const btnSm = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
export const btnSmPrimary = `${btnSm} bg-grad text-on-accent hover:brightness-110`;
export const btnSmGhost = `${btnSm} border border-line text-ink hover:bg-sunk`;
export const btnSmAccent = `${btnSm} border border-accent/50 text-accent hover:bg-accent/10`;
