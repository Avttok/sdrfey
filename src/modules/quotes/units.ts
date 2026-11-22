/** A Fey vende em CENTO: 0,2 cento = 20 unidades. Sem banco: o navegador também usa. */
export const isCento = (unit: string | null | undefined) => /^CE?N/i.test((unit ?? "").trim());

/** Quantidade real em peças. */
export const unitsOf = (qty: number, unit: string | null | undefined) => (isCento(unit) ? Math.round(qty * 100 * 1000) / 1000 : qty);

/** "20 un (0,2 cento)" para cento; as demais unidades aparecem como vieram. */
export function fmtQty(qty: number, unit: string | null | undefined): string {
  const nf = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return isCento(unit) ? `${nf(unitsOf(qty, unit))} un (${nf(qty)} cento)` : `${nf(qty)}${unit ? ` ${unit}` : ""}`;
}
