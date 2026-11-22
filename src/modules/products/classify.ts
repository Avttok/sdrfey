/** Classificação de produtos pela nomenclatura: sigla → significado. Funções puras (o navegador também usa). */
export type Term = { code: string; meaning: string; category: string };

export const tokensOf = (desc: string): string[] => desc.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^A-Z0-9]+/).filter(Boolean);

/** Tags de um produto: cada sigla conhecida que aparece na descrição. */
export function classifyProduct(description: string, terms: Term[]): Term[] {
  const by = new Map(terms.map((t) => [t.code.toUpperCase(), t]));
  const seen = new Set<string>();
  const out: Term[] = [];
  for (const tk of tokensOf(description)) { const t = by.get(tk); if (t && !seen.has(tk)) { seen.add(tk); out.push(t); } }
  return out;
}

/** Palavras curtas que não são siglas de produto. */
const STOP = new Set(["DE", "DA", "DO", "DAS", "DOS", "COM", "SEM", "PARA", "POR", "EM", "NO", "NA", "OU", "UM", "UMA", "MM", "CM", "KG", "UN", "PC", "PCS", "CEN", "CX", "PAR", "SET", "KIT", "TIPO", "NR", "NO", "N", "X", "E", "A", "O"]);

export type UnknownTerm = { code: string; count: number; example: string };
/** Siglas (2 a 4 letras) que aparecem em pelo menos `min` descrições e ainda não têm significado. */
export function findUnknownTerms(descriptions: string[], known: Iterable<string>, min = 2): UnknownTerm[] {
  const k = new Set([...known].map((c) => c.toUpperCase()));
  const count = new Map<string, { n: number; ex: string }>();
  for (const d of descriptions) {
    for (const tk of new Set(tokensOf(d))) {
      if (!/^[A-Z]{2,4}$/.test(tk) || STOP.has(tk) || k.has(tk)) continue;
      const c = count.get(tk);
      if (c) c.n++; else count.set(tk, { n: 1, ex: d });
    }
  }
  return [...count.entries()].filter(([, v]) => v.n >= min).map(([code, v]) => ({ code, count: v.n, example: v.ex })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, 60);
}

export const TERM_CATEGORIES = ["Material", "Rosca", "Cabeça", "Acabamento", "Tipo", "Medida", "Classe", "Outros"] as const;
