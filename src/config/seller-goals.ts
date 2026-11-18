/** Metas mensais do vendedor. Cada métrica tem meta padrão e peso (quanto ela pesa na meta geral). */
export const SELLER_METRICS = [
  { key: "calls", label: "Ligações", kind: "count", target: 600, weight: 10, hint: "Ligações registradas nas negociações no mês" },
  { key: "engaged", label: "Engajados", kind: "count", target: 30, weight: 25, hint: "Clientes diferentes com quem você falou no mês" },
  { key: "quotes", label: "Cotações", kind: "money", target: 100_000, weight: 20, hint: "Valor das cotações enviadas no mês" },
  { key: "sold", label: "Vendidos/Faturados", kind: "money", target: 50_000, weight: 20, hint: "Valor das vendas fechadas no mês" },
  { key: "reactivated", label: "Reativados", kind: "count", target: 15, weight: 25, hint: "Clientes inativos que voltaram a comprar no mês" },
] as const;
export type SellerMetricKey = (typeof SELLER_METRICS)[number]["key"];

/** Bônus por venda: vale a primeira venda de cada cliente. */
export const SALE_BONUS_REAIS = 15;

export type SellerGoalSettings = Partial<Record<string, number>>;
export type SellerTargets = Record<SellerMetricKey, number>;
export type SellerWeights = Record<SellerMetricKey, number>;

export type SellerEnabled = Record<SellerMetricKey, boolean>;

/** Metas e pesos valendo para uma pessoa: o que ela tem de próprio, senão o global (settings), senão o padrão do sistema.
 *  Liga/desliga: `off_<métrica>` (1 = desligada, 0 = ligada à força; ausente = herda) e `off_all` (desliga tudo desta pessoa). */
export function resolveSellerGoals(global: SellerGoalSettings, own: Record<string, number> = {}): { targets: SellerTargets; weights: SellerWeights; enabled: SellerEnabled; allOff: boolean } {
  const targets = {} as SellerTargets, weights = {} as SellerWeights, enabled = {} as SellerEnabled;
  const allOff = own.off_all === 1;
  for (const m of SELLER_METRICS) {
    targets[m.key] = own[m.key] ?? global[m.key] ?? m.target;
    weights[m.key] = global[`w_${m.key}`] ?? m.weight;
    enabled[m.key] = !allOff && (own[`off_${m.key}`] ?? global[`off_${m.key}`] ?? 0) !== 1;
  }
  return { targets, weights, enabled, allOff };
}

export type SellerActuals = Record<SellerMetricKey, number>;

/** % de cada métrica (sem teto) e a meta geral: soma dos pesos × atingimento de cada uma (cada uma limitada a 100%).
 *  Métricas desligadas ficam de fora e os pesos das restantes são reescalados. */
export function attainment(actual: SellerActuals, targets: SellerTargets, weights: SellerWeights, enabled?: SellerEnabled) {
  const each = {} as Record<SellerMetricKey, number>;
  let sum = 0, wsum = 0;
  for (const m of SELLER_METRICS) {
    const t = targets[m.key];
    const pct = t > 0 ? (actual[m.key] / t) * 100 : 0;
    each[m.key] = pct;
    if (enabled && !enabled[m.key]) continue;
    sum += weights[m.key] * Math.min(pct, 100);
    wsum += weights[m.key];
  }
  return { each, overall: wsum > 0 ? sum / wsum : 0 };
}
