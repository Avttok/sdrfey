import ExcelJS from "exceljs";

export type SheetInfo = { name: string; rows: number; cols: number; csv: string };

const pad = (n: number) => String(n).padStart(2, "0");
function text(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("result" in o) return text(o.result as ExcelJS.CellValue);
    if ("text" in o) return String(o.text ?? "");
    if ("hyperlink" in o) return String(o.hyperlink ?? "");
    if ("error" in o) return "";
  }
  return String(v);
}
const esc = (s: string) => (/[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Lê todas as abas de um .xlsx e devolve cada uma como CSV (a primeira linha não vazia vira o cabeçalho). */
export async function readXlsxSheets(buf: ArrayBuffer, maxRows: number): Promise<SheetInfo[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: SheetInfo[] = [];
  for (const ws of wb.worksheets) {
    const lines: string[][] = [];
    let cols = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (lines.length > maxRows) return;
      const n = Math.max(row.cellCount, ws.columnCount);
      const cells: string[] = [];
      for (let c = 1; c <= n; c++) cells.push(text(row.getCell(c).value).trim());
      if (cells.some(Boolean)) { lines.push(cells); cols = Math.max(cols, cells.length); }
    });
    if (lines.length === 0) continue;
    const csv = lines.map((l) => Array.from({ length: cols }, (_, i) => esc(l[i] ?? "")).join(",")).join("\n");
    out.push({ name: ws.name, rows: Math.max(0, lines.length - 1), cols, csv });
  }
  return out;
}
