/** Transportadoras: tipos de frete e cálculo de estimativa (sem banco: o navegador também usa). */
export const FREIGHT_MODES = { CIF: "CIF (Fey paga)", FOB: "FOB (cliente paga)", RED: "Redespacho" } as const;
export type FreightMode = keyof typeof FREIGHT_MODES;
export const isMode = (m: string): m is FreightMode => m in FREIGHT_MODES;

export type CarrierRow = { id: number; uf: string; mode: FreightMode; name: string; capitalPct: number | null; interiorPct: number | null; capitalDays: number | null; interiorDays: number | null; minCents: number | null; contact: string | null; note: string | null; active: boolean };

/** Frete estimado de um pedido: % da região sobre o valor, respeitando o mínimo da transportadora. */
export function estimateFreight(c: Pick<CarrierRow, "capitalPct" | "interiorPct" | "capitalDays" | "interiorDays" | "minCents">, region: "capital" | "interior", orderCents: number): { cents: number; days: number | null } | null {
  const pct = region === "capital" ? c.capitalPct : c.interiorPct;
  if (pct == null) return null;
  const raw = Math.round(orderCents * pct / 100);
  return { cents: Math.max(raw, c.minCents ?? 0), days: region === "capital" ? c.capitalDays : c.interiorDays };
}
