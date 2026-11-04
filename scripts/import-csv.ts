/**
 * Importa um CSV pelo terminal (a tela de upload do app usa os mesmos módulos).
 *
 *   npm run import:csv -- leads  caminho/DB_LD.csv
 *   npm run import:csv -- reps   caminho/DB_RP.csv
 *   npm run import:csv -- leads  caminho/DB_LD.csv --dry     (só mostra o relatório, não grava)
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { sql } from "../src/db";
import { decodeCsv, parseCsv } from "../src/modules/import/csv";
import { parseLeadRows } from "../src/modules/import/leads-parse";
import { applyLeadDrafts } from "../src/modules/import/leads-apply";
import { applyRepDrafts, parseRepRows } from "../src/modules/import/reps";

async function main() {
  const [kind, file, ...flags] = process.argv.slice(2);
  const dry = flags.includes("--dry");
  if (!["leads", "reps"].includes(kind) || !file) {
    console.error("Uso: npm run import:csv -- <leads|reps> <arquivo.csv> [--dry]");
    process.exit(1);
  }
  const { headers, rows } = parseCsv(decodeCsv(readFileSync(file)));
  const sourceName = basename(file);

  if (kind === "leads") {
    const { drafts, report } = parseLeadRows(headers, rows);
    console.log(JSON.stringify(report, null, 2));
    if (dry) return;
    const result = await applyLeadDrafts(drafts, { importedBy: null, sourceName });
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { drafts, warnings } = parseRepRows(headers, rows);
    if (warnings.length) console.log(warnings.join("\n"));
    if (dry) return console.log(`${drafts.length} representantes lidos`);
    console.log(JSON.stringify(await applyRepDrafts(drafts, { importedBy: null, sourceName }), null, 2));
  }
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
