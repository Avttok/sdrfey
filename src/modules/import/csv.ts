import Papa from "papaparse";

/** Lê os bytes do arquivo: tenta UTF-8 e, se falhar, assume Windows-1252 (Excel brasileiro). */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    text = new TextDecoder("windows-1252").decode(view);
  }
  return text.replace(/^﻿/, "");
}

export type ParsedCsv = { headers: string[]; rows: Record<string, string>[] };

/** Aceita vírgula ou ponto e vírgula, aspas, linhas em branco. */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return { headers: result.meta.fields ?? [], rows: result.data };
}

/**
 * Colunas repetidas do mesmo tipo (telefone, e-mail, contato) viram uma só: os valores de cada linha são juntados.
 * O Papa Parse renomeia repetidas como "Telefone_1"; aqui o sufixo é ignorado.
 */
export function mergeRepeatedColumns(parsed: ParsedCsv, isMulti: (header: string) => string | null): ParsedCsv {
  const groups = new Map<string, string[]>();
  for (const h of parsed.headers) {
    const k = isMulti(h.replace(/[_\s]*\(?\d+\)?$/, "")) ?? isMulti(h);
    if (k) groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  const drop = new Set<string>();
  const sep: Record<string, string> = { phone: ", ", email: "; ", contact: " / " };
  const rows = parsed.rows.map((r) => ({ ...r }));
  for (const [k, cols] of groups) {
    if (cols.length < 2) continue;
    const [main, ...rest] = cols;
    for (const r of rows) r[main] = [...new Set(cols.map((c) => (r[c] ?? "").trim()).filter(Boolean))].join(sep[k] ?? ", ");
    rest.forEach((c) => drop.add(c));
  }
  return { headers: parsed.headers.filter((h) => !drop.has(h)), rows };
}
