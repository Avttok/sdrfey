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
