/** Classificação de porte e capital social, igual à da planilha antiga (AppScript). Sem rede, fácil de testar. */

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

export function classifyPorte(input: { porte: string | null; activity: string | null; capital: number | null; nature: string | null; isMei: boolean | null }): string | null {
  const p = norm(input.porte);
  const cnae = norm(input.activity);
  const nat = norm(input.nature);
  const cap = input.capital ?? 0;
  const micro = p.includes("MICRO") || p === "ME";
  if ((micro || input.isMei === true) && nat.includes("INDIVIDUAL")) return "MEI (1 FUNC.)";
  if (p.includes("MEI")) return "MEI";
  if (micro) return "ME (ATÉ 9 FUNC.)";
  if (p.includes("EPP") || p.includes("PEQUENO")) return "EPP (10 A 49 FUNC.)";
  if (p.includes("MEDIO")) return "MÉDIA (50 A 99 FUNC.)";
  if (p.includes("GRANDE")) return "GRANDE (100+ FUNC.)";
  if (p === "" || p.includes("DEMAIS")) {
    if (/INDUSTRIA|FABRICANTE|FABRICACAO/.test(cnae)) return "INDUSTRIA (500+ FUNC.)";
    return cap >= 500_000 ? "GRANDE (100+ FUNC.)" : "MÉDIA (50 A 99 FUNC.)";
  }
  return null;
}

const LIMITS = [1000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000, 10000000, 100000000, 500000000, 1000000000];

/** Faixa de capital: o maior limite que o capital alcança (mínimo R$ 1.000). Ex.: 12.500 → "R$ 10.000". */
export function classifyCapital(capital: number | null): { label: string; value: number } | null {
  if (capital == null || !Number.isFinite(capital)) return null;
  let chosen = LIMITS[0];
  for (const l of LIMITS) { if (capital >= l) chosen = l; else break; }
  return { label: `R$ ${chosen.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, value: chosen };
}
