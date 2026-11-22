/** Troca de termos em textos (e dentro de JSON). Puro, sem banco: serve à tela do Glossário e aos testes. */
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function buildRe(o: { from: string; matchCase: boolean; wholeWord: boolean }): RegExp {
  const core = esc(o.from);
  return new RegExp(o.wholeWord ? `(?<![\\p{L}\\p{N}_])${core}(?![\\p{L}\\p{N}_])` : core, `gu${o.matchCase ? "" : "i"}`);
}

/** Troca em todo texto de um valor (inclusive dentro de JSON), devolvendo o novo valor e quantas trocas houve. */
export function replaceDeep(v: unknown, re: RegExp, to: string): { value: unknown; n: number } {
  if (typeof v === "string") {
    let n = 0;
    const value = v.replace(re, () => { n++; return to; });
    return { value, n };
  }
  if (Array.isArray(v)) { let n = 0; const value = v.map((x) => { const r = replaceDeep(x, re, to); n += r.n; return r.value; }); return { value, n }; }
  if (v && typeof v === "object") { let n = 0; const value: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) { const r = replaceDeep(x, re, to); n += r.n; value[k] = r.value; } return { value, n }; }
  return { value: v, n: 0 };
}

