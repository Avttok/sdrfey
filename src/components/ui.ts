/** Classes reutilizáveis. Mude aqui e todos os botões e campos do sistema mudam juntos. */

export const inputCls =
  "min-h-11 w-full rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 " +
  "transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export const labelCls = "mb-1.5 block text-sm font-medium text-ink";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-grad px-4 py-2 text-[15px] font-bold shadow-md shadow-accent/25 " +
  "text-on-accent transition active:scale-[0.98] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-line px-4 py-2 text-[15px] font-semibold " +
  "text-ink transition-colors hover:border-accent/50 hover:bg-sunk";

/** Painel de vidro: translúcido com desfoque leve; o degradê do tema aparece por trás. */
export const panelCls = "card-edge card-surface rounded-2xl shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_30px_-16px_rgb(0_0_0/0.18)]";

/**
 * Botões pequenos (linhas de lista, cartões, barras): uma altura só (h-9), cantos e texto iguais em todo o sistema.
 * Use estes em vez de montar classes soltas, para os botões nunca ficarem de tamanhos diferentes lado a lado.
 */
export const btnSm = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
export const btnSmPrimary = `${btnSm} bg-grad text-on-accent hover:brightness-110`;
export const btnSmGhost = `${btnSm} border-2 border-line text-ink hover:border-accent/50 hover:bg-sunk`;
export const btnSmAccent = `${btnSm} border-2 border-accent/50 text-accent hover:bg-accent/10`;
