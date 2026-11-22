"use server";

import { getSettings } from "@/modules/settings/get";
import { requireUser } from "@/modules/auth/guard";
import { decodeCsv, parseCsv } from "./csv";
import { readXlsxSheets } from "./sheets";

export type SheetsResult = { ok: true; sheets: { name: string; rows: number; cols: number; csv: string }[] } | { ok: false; message: string };

/** Abre a planilha enviada (qualquer importação): .xlsx devolve uma entrada por aba; .csv devolve uma só. Nada é gravado. */
export async function readSheetsAction(formData: FormData): Promise<SheetsResult> {
  const me = await requireUser();
  if (!(me.permissions["tab.negociacoes"] || me.permissions["carriers.edit"] || me.permissions["tab.importar"] || me.roles.includes("admin"))) return { ok: false, message: "Sem permissão para importar." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha um arquivo." };
  const cfg = await getSettings();
  if (file.size > cfg.import_max_mb * 1024 * 1024) return { ok: false, message: `Arquivo grande demais (máximo ${cfg.import_max_mb} MB).` };
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const sheets = await readXlsxSheets(await file.arrayBuffer(), cfg.import_max_rows);
      if (!sheets.length) return { ok: false, message: "Não encontrei dados em nenhuma aba." };
      return { ok: true, sheets };
    }
    if (/\.xls$/i.test(file.name)) return { ok: false, message: "Arquivo .xls antigo: salve como .xlsx ou .csv e envie de novo." };
    const { headers, rows } = parseCsv(decodeCsv(Buffer.from(await file.arrayBuffer())));
    return { ok: true, sheets: [{ name: "CSV", rows: rows.length, cols: headers.length, csv: "" }] };
  } catch {
    return { ok: false, message: "Não consegui abrir o arquivo." };
  }
}
