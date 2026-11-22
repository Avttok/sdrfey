/** ICMS das cotações: regra do Adm (global e por UF) e override por cotação. Sem banco: o navegador também usa. */
export type IcmsRule = { mode: "pdf" | "rate"; defaultPct: number; byUf: Record<string, number> };

/** 7% para quem fica no Norte, Nordeste, Centro-Oeste e ES; 12% para Sul e Sudeste (o Adm ajusta tudo na tela). */
const SEVEN = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO"];
const TWELVE = ["MG", "PR", "RJ", "RS", "SC", "SP"];
export const DEFAULT_ICMS_RULE: IcmsRule = { mode: "pdf", defaultPct: 12, byUf: { ...Object.fromEntries(SEVEN.map((u) => [u, 7])), ...Object.fromEntries(TWELVE.map((u) => [u, 12])) } };

const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 40 ? Math.round(n * 100) / 100 : null; };

export function cleanIcmsRule(raw: unknown): IcmsRule {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const byUf: Record<string, number> = { ...DEFAULT_ICMS_RULE.byUf };
  if (r.byUf && typeof r.byUf === "object") for (const [k, v] of Object.entries(r.byUf as Record<string, unknown>)) { const p = pct(v); if (/^[A-Z]{2}$/.test(k) && p !== null) byUf[k] = p; }
  return { mode: r.mode === "rate" ? "rate" : "pdf", defaultPct: pct(r.defaultPct) ?? DEFAULT_ICMS_RULE.defaultPct, byUf };
}

/** Percentual que vale para a cotação: o digitado nela > o da UF > o padrão. Sem regra ativa (modo PDF) e sem digitado = null (vale o que veio no PDF). */
export function pickIcmsPct(rule: IcmsRule, uf: string | null | undefined, override?: number | null): number | null {
  if (override != null && Number.isFinite(override) && override >= 0 && override <= 40) return override;
  if (rule.mode !== "rate") return null;
  return rule.byUf[(uf ?? "").toUpperCase()] ?? rule.defaultPct;
}

/** Texto digitado ("12", "7,5") vira número; vazio ou inválido = sem override. */
export function parsePctInput(s: string | null | undefined): number | null {
  const t = (s ?? "").trim().replace("%", "").replace(",", ".");
  return t === "" ? null : pct(t);
}
