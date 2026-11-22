import ExcelJS from "exceljs";
import type { Col, Report } from "./report";

const FMT: Record<NonNullable<Col["fmt"]>, string | undefined> = { text: undefined, int: "#,##0", brl: '"R$" #,##0.00', pct: "0.0%", date: "dd/mm/yyyy", datetime: "dd/mm/yyyy hh:mm", dec: "#,##0.00" };
const INK = "FF1E293B", ACC = "FF6366F1", SOFT = "FFEEF2FF", LINE = "FFE2E8F0";

function cellValue(v: string | number | null | undefined, fmt?: Col["fmt"]) {
  if (v == null || v === "") return null;
  if ((fmt === "date" || fmt === "datetime") && typeof v === "string") { const d = new Date(fmt === "date" ? `${v.slice(0, 10)}T12:00:00` : v); return Number.isNaN(d.getTime()) ? v : d; }
  return v;
}

/** Monta a planilha bonita: capa com os números-chave + uma aba por conteúdo (cabeçalho colorido, filtros, linhas zebradas, congelado). */
export async function buildWorkbook(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SDR FEY"; wb.created = new Date();
  const cover = wb.addWorksheet("Capa", { views: [{ showGridLines: false }], properties: { tabColor: { argb: ACC } } });
  cover.columns = [{ width: 3 }, { width: 34 }, { width: 22 }, { width: 46 }];
  cover.mergeCells("B2:D2"); const t = cover.getCell("B2"); t.value = r.title; t.font = { size: 24, bold: true, color: { argb: "FFFFFFFF" } }; t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACC } }; t.alignment = { vertical: "middle", indent: 1 }; cover.getRow(2).height = 46;
  cover.mergeCells("B3:D3"); const s = cover.getCell("B3"); s.value = `Período: ${r.subtitle}`; s.font = { size: 12, color: { argb: INK } }; s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } }; s.alignment = { indent: 1, vertical: "middle" }; cover.getRow(3).height = 24;
  cover.mergeCells("B4:D4"); const p = cover.getCell("B4"); p.value = `Pessoas: ${r.people.join(", ") || "—"}`; p.font = { size: 11, color: { argb: "FF64748B" } }; p.alignment = { indent: 1, wrapText: true, vertical: "middle" }; cover.getRow(4).height = 22;
  let row = 6;
  for (const k of ["Indicador", "Valor", "Observação"]) cover.getCell(row, ["Indicador", "Valor", "Observação"].indexOf(k) + 2).value = k;
  for (let c = 2; c <= 4; c++) { const x = cover.getCell(row, c); x.font = { bold: true, color: { argb: "FFFFFFFF" } }; x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } }; }
  row++;
  r.summary.forEach((m, i) => {
    const a = cover.getCell(row, 2), b = cover.getCell(row, 3), c = cover.getCell(row, 4);
    a.value = m.label; b.value = m.value; c.value = m.hint ?? "";
    b.font = { bold: true, color: { argb: ACC } }; b.alignment = { horizontal: "right" }; c.font = { color: { argb: "FF64748B" }, italic: true };
    for (const x of [a, b, c]) { x.border = { bottom: { style: "thin", color: { argb: LINE } } }; if (i % 2) x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }; }
    row++;
  });
  cover.getCell(row + 1, 2).value = `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · SDR FEY`; cover.getCell(row + 1, 2).font = { size: 9, color: { argb: "FF94A3B8" } };

  const used = new Set<string>(["Capa"]);
  for (const sh of r.sheets) {
    let name = sh.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Aba"; let n = 2; while (used.has(name)) name = `${name.slice(0, 28)} ${n++}`; used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sh.cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: FMT[c.fmt ?? "text"] ? { numFmt: FMT[c.fmt ?? "text"] } : {} }));
    const head = ws.getRow(1); head.height = 26;
    head.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACC } }; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
    sh.rows.forEach((rw, i) => {
      const x = ws.addRow(sh.cols.map((c) => cellValue(rw[c.key], c.fmt)));
      x.eachCell({ includeEmpty: true }, (c, ci) => { const f = sh.cols[ci - 1]?.fmt; if (FMT[f ?? "text"]) c.numFmt = FMT[f ?? "text"]!; c.border = { bottom: { style: "hair", color: { argb: LINE } } }; if (i % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }; });
    });
    if (sh.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.cols.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** CSV de uma aba (separador ";" e BOM, abre direto no Excel brasileiro). */
export function sheetCsv(r: Report, id?: string): string {
  const sh = r.sheets.find((s) => s.id === id) ?? r.sheets[0];
  if (!sh) return "﻿";
  const q = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const f = (v: string | number | null, fmt?: Col["fmt"]) => (v == null ? "" : typeof v === "number" ? (fmt === "pct" ? `${(v * 100).toFixed(1)}%`.replace(".", ",") : String(v).replace(".", ",")) : v);
  return "﻿" + [sh.cols.map((c) => q(c.header)).join(";"), ...sh.rows.map((rw) => sh.cols.map((c) => q(f(rw[c.key] ?? null, c.fmt))).join(";"))].join("\r\n");
}

const brDay = (v: string) => { const d = new Date(`${v.slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR"); };
function pdfCell(v: string | number | null | undefined, fmt?: Col["fmt"]): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return fmt === "pct" ? `${(v * 100).toFixed(1).replace(".", ",")}%` : fmt === "brl" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : fmt === "dec" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v.toLocaleString("pt-BR");
  if (fmt === "date") return brDay(v);
  if (fmt === "datetime") { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }); }
  return v;
}

/** O mesmo relatório em PDF: capa com os números-chave e uma tabela por aba (até 5.000 linhas cada). */
export async function buildReportPdf(r: Report): Promise<Uint8Array> {
  const { buildPdf, PDF_MAX_ROWS } = await import("@/modules/export/pdf");
  return buildPdf({
    title: r.title, subtitle: `Período: ${r.subtitle} · Pessoas: ${r.people.join(", ") || "—"}`.slice(0, 200),
    summary: r.summary.map((m) => [m.label, m.hint ? `${m.value}  (${m.hint})` : m.value] as [string, string]),
    sections: r.sheets.map((sh) => ({
      name: sh.name, headers: sh.cols.map((c) => c.header), right: sh.cols.map((c) => !!c.fmt && c.fmt !== "text" && c.fmt !== "date" && c.fmt !== "datetime"),
      rows: sh.rows.slice(0, PDF_MAX_ROWS).map((rw) => sh.cols.map((c) => pdfCell(rw[c.key], c.fmt))),
      note: sh.rows.length > PDF_MAX_ROWS ? `Mostrando as primeiras ${PDF_MAX_ROWS.toLocaleString("pt-BR")} de ${sh.rows.length.toLocaleString("pt-BR")} linhas. O Excel traz tudo.` : undefined,
    })),
  });
}
