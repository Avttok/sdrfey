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

export const panelCls = "rounded-xl border border-line bg-panel bg-grad-panel";
