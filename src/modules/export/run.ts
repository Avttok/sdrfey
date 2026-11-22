import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { EX_BY_KEY, EX_DATASETS_KEYS, EX_FORMATS, EX_MAX_ROWS, type ExCol, type ExDataset, type ExDatasetKey, type ExFilter, type ExFormat, type ExRequest } from "@/config/export-spec";
import { zipSync, strToU8 } from "fflate";
import { buildPdf, PDF_MAX_ROWS, type PdfSection } from "./pdf";
import { conditions, countRows, loadOptions, selectSql } from "./sql";

const PAGE = 2000;
export const isDatasetKey = (k: unknown): k is ExDatasetKey => typeof k === "string" && (EX_DATASETS_KEYS as readonly string[]).includes(k);
export const isFormat = (k: unknown): k is ExFormat => EX_FORMATS.some((f) => f.key === k);

/** Confere o pedido que veio da tela e devolve só o que é válido (colunas conhecidas, formato conhecido, limite dentro do teto). */
export function cleanRequest(raw: unknown): ExRequest | null {
  const r = (raw ?? {}) as Partial<ExRequest>;
  if (!isDatasetKey(r.dataset)) return null;
  const ds = EX_BY_KEY.get(r.dataset)!;
  const known = new Set(ds.columns.map((c) => c.key));
  const picked = Array.isArray(r.columns) ? r.columns.filter((c): c is string => typeof c === "string" && known.has(c)) : [];
  const columns = ds.columns.map((c) => c.key).filter((k) => picked.includes(k));
  if (!columns.length) return null;
  const filters = r.filters && typeof r.filters === "object" && !Array.isArray(r.filters) ? (r.filters as Record<string, unknown>) : {};
  const sort = r.sort && known.has(r.sort.key) ? { key: r.sort.key, dir: r.sort.dir === "desc" ? ("desc" as const) : ("asc" as const) } : null;
  const limit = typeof r.limit === "number" && r.limit > 0 ? Math.min(Math.floor(r.limit), EX_MAX_ROWS) : null;
  return { dataset: r.dataset, columns, filters, format: isFormat(r.format) ? r.format : "xlsx", sort, limit };
}

type Cell = string | number | boolean | Date | null;
function coerce(v: unknown, kind: ExCol["kind"]): Cell {
  if (v === null || v === undefined || v === "") return null;
  if (kind === "datetime" || kind === "date") {
    const d = v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T12:00:00Z` : String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d;
  }
  if (kind === "int" || kind === "money") { const n = Number(v); return Number.isFinite(n) ? n : String(v); }
  if (v instanceof Date) return v;
  return typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);
}
const ptDate = (d: Date, withTime: boolean) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", ...(withTime ? { timeStyle: "short" } : {}) }).format(d);
const plain = (v: Cell, kind: ExCol["kind"]): string | number | boolean | null => (v instanceof Date ? ptDate(v, kind === "datetime") : v);
const brNum = (n: number, kind: ExCol["kind"], comma: boolean) => (kind === "money" ? (comma ? n.toFixed(2).replace(".", ",") : n.toFixed(2)) : String(n));

async function* pages(req: ExRequest, cols: ExCol[], where: ReturnType<typeof conditions>["where"], total: number) {
  const max = Math.min(req.limit ?? EX_MAX_ROWS, EX_MAX_ROWS, total);
  for (let off = 0; off < max; off += PAGE) {
    const rows = await db.execute<Record<string, unknown>>(selectSql(req.dataset, cols.map((c) => c.key), where, { limit: Math.min(PAGE, max - off), offset: off, sort: req.sort }));
    yield [...rows].map((r) => cols.map((c) => coerce(r[c.key], c.kind)));
  }
}

const display = (v: Cell, kind: ExCol["kind"]): string => { const p = plain(v, kind); return p === null ? "" : typeof p === "boolean" ? (p ? "SIM" : "NÃO") : kind === "money" && typeof p === "number" ? p.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : kind === "int" && typeof p === "number" ? p.toLocaleString("pt-BR") : String(p); };

/** Tabela já formatada em texto (para PDF e para o CSV dentro do pacote), até `cap` linhas. */
async function tableOf(req: ExRequest, cap: number) {
  const ds = EX_BY_KEY.get(req.dataset)!;
  const cols = req.columns.map((k) => ds.columns.find((c) => c.key === k)!);
  const { where, applied } = conditions(req.dataset, req.filters);
  const total = await countRows(req.dataset, where);
  const rows: string[][] = [];
  for await (const chunk of pages({ ...req, limit: Math.min(req.limit ?? cap, cap) }, cols, where, total)) for (const r of chunk) rows.push(r.map((v, i) => display(v, cols[i].kind)));
  return { ds, cols, rows, total, applied };
}
const pdfSection = (t: Awaited<ReturnType<typeof tableOf>>, cap: number): PdfSection => ({ name: t.ds.label, headers: t.cols.map((c) => c.label), rows: t.rows, right: t.cols.map((c) => c.kind === "int" || c.kind === "money"), note: t.total > t.rows.length ? `Mostrando as primeiras ${t.rows.length.toLocaleString("pt-BR")} de ${t.total.toLocaleString("pt-BR")} linhas. Para a base inteira use Excel ou CSV.` : undefined });

export const stamp = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const stampTime = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date());

/** Texto legível de um filtro preenchido (para a aba "Filtros"). */
async function describeFilters(ds: ExDataset, applied: { key: string; value: unknown }[]): Promise<[string, string][]> {
  const out: [string, string][] = [];
  const dynCache = new Map<string, Map<string, string>>();
  for (const a of applied) {
    const f = ds.filters.find((x) => x.key === a.key) as ExFilter | undefined;
    if (!f) continue;
    const v = a.value as unknown;
    let text = "";
    if (f.type === "multi" && Array.isArray(v)) {
      let map = f.options ? new Map(f.options.map((o) => [o.value, o.label])) : undefined;
      if (!map && f.dyn) { if (!dynCache.has(f.dyn)) dynCache.set(f.dyn, new Map((await loadOptions(f.dyn)).map((o) => [o.value, o.label]))); map = dynCache.get(f.dyn); }
      text = v.map((x) => map?.get(String(x)) ?? String(x)).join(", ");
    } else if (f.type === "tri") text = v === "sim" ? "Sim" : "Não";
    else if (f.type === "date") { const r = v as { from?: string; to?: string }; text = [r.from ? `de ${r.from.split("-").reverse().join("/")}` : "", r.to ? `até ${r.to.split("-").reverse().join("/")}` : ""].filter(Boolean).join(" ") ; }
    else if (f.type === "num") { const r = v as { min?: number; max?: number }; text = [r.min !== undefined ? `mín. ${r.min}` : "", r.max !== undefined ? `máx. ${r.max}` : ""].filter(Boolean).join(" · "); }
    else text = String(v);
    out.push([f.label, text]);
  }
  return out;
}

const HEAD = { fill: "FF4F46E5", font: "FFFFFFFF", band: "FFF5F5FB" };
const widthOf = (c: ExCol) => Math.min(48, Math.max(12, c.label.length + 4, c.kind === "datetime" ? 18 : c.kind === "date" ? 13 : c.kind === "money" ? 16 : c.kind === "int" ? 12 : 22));

type Sheet = { name: string; req: ExRequest };

async function writeSheet(wb: ExcelJS.stream.xlsx.WorkbookWriter, name: string, req: ExRequest) {
  const ds = EX_BY_KEY.get(req.dataset)!;
  const cols = req.columns.map((k) => ds.columns.find((c) => c.key === k)!);
  const { where } = conditions(req.dataset, req.filters);
  const total = await countRows(req.dataset, where);
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: widthOf(c), style: { numFmt: c.kind === "money" ? '"R$" #,##0.00' : c.kind === "datetime" ? "dd/mm/yyyy hh:mm" : c.kind === "date" ? "dd/mm/yyyy" : c.kind === "int" ? "#,##0" : undefined } }));
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEAD.font }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD.fill } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  head.commit();
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  let n = 0;
  for await (const chunk of pages(req, cols, where, total)) for (const r of chunk) { ws.addRow(r).commit(); n++; }
  ws.commit();
  return { total, written: n };
}

async function xlsx(out: PassThrough, sheets: Sheet[], opts: { title: string; summary?: boolean }) {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true, useSharedStrings: false });
  wb.creator = "SDR FEY"; wb.created = new Date();
  const counts: [string, number][] = [];
  const filterRows: [string, string, string][] = [];
  for (const s of sheets) {
    const r = await writeSheet(wb, s.name, s.req);
    counts.push([s.name, r.total]);
    const ds = EX_BY_KEY.get(s.req.dataset)!;
    const { applied } = conditions(s.req.dataset, s.req.filters);
    for (const [k, v] of await describeFilters(ds, applied)) filterRows.push([s.name, k, v]);
  }
  const info = wb.addWorksheet(opts.summary ? "Resumo" : "Filtros", { properties: { tabColor: { argb: HEAD.fill } } });
  info.columns = [{ width: 30 }, { width: 34 }, { width: 60 }];
  info.addRow([opts.title]).font = { bold: true, size: 16 };
  info.addRow(["Gerado em", stampTime()]);
  info.addRow([]);
  if (opts.summary) {
    const h = info.addRow(["Planilha", "Linhas"]); h.font = { bold: true };
    for (const [n, c] of counts) info.addRow([n, c]);
    info.addRow([]);
  }
  const h2 = info.addRow([opts.summary ? "Planilha" : "Filtro", opts.summary ? "Filtro" : "Valor", opts.summary ? "Valor" : ""]); h2.font = { bold: true };
  if (!filterRows.length) info.addRow(["Nenhum filtro: todos os registros."]);
  for (const [sheet, k, v] of filterRows) info.addRow(opts.summary ? [sheet, k, v] : [k, v]);
  info.commit();
  await wb.commit();
  return counts;
}

function csvEscape(v: string, sep: string) { return /["\n\r]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v; }

/** Gera o arquivo aos poucos (não carrega a tabela inteira na memória) e devolve o fluxo para a resposta. */
export function streamExport(req: ExRequest): { stream: ReadableStream<Uint8Array>; filename: string; mime: string } {
  const ds = EX_BY_KEY.get(req.dataset)!;
  const base = `sdrfey-${req.dataset}-${stamp()}`;
  const cols = req.columns.map((k) => ds.columns.find((c) => c.key === k)!);
  if (req.format === "pdf") {
    const stream = new ReadableStream<Uint8Array>({ async start(c) {
      try {
        const cap = req.columns.length > 14 ? 1500 : PDF_MAX_ROWS; // muitas colunas viram várias faixas: menos linhas para o PDF não passar de centenas de páginas
        const t = await tableOf(req, cap);
        const fl = await describeFilters(ds, t.applied);
        c.enqueue(await buildPdf({ title: `SDR FEY · ${ds.label}`, subtitle: `Gerado em ${stampTime()}${fl.length ? " · Filtros: " + fl.map(([k, v]) => `${k}: ${v}`).join(" | ") : " · sem filtros"}`.slice(0, 220), sections: [pdfSection(t, cap)] }));
        c.close();
      } catch (e) { c.error(e); }
    } });
    return { stream, filename: `${base}.pdf`, mime: "application/pdf" };
  }
  if (req.format === "xlsx") {
    const pass = new PassThrough();
    xlsx(pass, [{ name: ds.label, req }], { title: `SDR FEY · ${ds.label}` }).catch((e) => pass.destroy(e as Error));
    return { stream: Readable.toWeb(pass) as ReadableStream<Uint8Array>, filename: `${base}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  const { where } = conditions(req.dataset, req.filters);
  const enc = new TextEncoder();
  const sep = req.format === "csv" ? ";" : ",";
  const json = req.format === "json";
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        const total = await countRows(req.dataset, where);
        if (json) c.enqueue(enc.encode("[\n")); else c.enqueue(enc.encode("﻿" + cols.map((x) => csvEscape(x.label, sep)).join(sep) + "\r\n"));
        let first = true;
        for await (const chunk of pages(req, cols, where, total)) {
          let buf = "";
          for (const r of chunk) {
            if (json) { buf += (first ? "" : ",\n") + JSON.stringify(Object.fromEntries(cols.map((x, i) => [x.label, r[i] instanceof Date ? (r[i] as Date).toISOString() : r[i]]))); first = false; }
            else buf += r.map((v, i) => { const p = plain(v, cols[i].kind); return p === null ? "" : csvEscape(typeof p === "number" ? brNum(p, cols[i].kind, sep === ";") : typeof p === "boolean" ? (p ? "SIM" : "NÃO") : String(p), sep); }).join(sep) + "\r\n";
          }
          c.enqueue(enc.encode(buf));
        }
        if (json) c.enqueue(enc.encode("\n]\n"));
        c.close();
      } catch (e) { c.error(e); }
    },
  });
  return { stream, filename: `${base}.${json ? "json" : "csv"}`, mime: json ? "application/json; charset=utf-8" : "text/csv; charset=utf-8" };
}

/** Pasta de trabalho completa: uma planilha por base liberada, com todas as colunas, mais a aba "Resumo". */
export function streamPackage(allowed: ExDatasetKey[], format: "xlsx" | "csv" | "pdf" = "xlsx"): { stream: ReadableStream<Uint8Array>; filename: string; mime: string } {
  const all = (k: ExDatasetKey): ExRequest => ({ dataset: k, columns: EX_BY_KEY.get(k)!.columns.map((c) => c.key), filters: {}, format: "xlsx", sort: null, limit: null });
  if (format !== "xlsx") {
    const stream = new ReadableStream<Uint8Array>({ async start(c) {
      try {
        if (format === "pdf") {
          const secs: PdfSection[] = [];
          for (const k of allowed) secs.push(pdfSection(await tableOf(all(k), 1500), 1500));
          c.enqueue(await buildPdf({ title: "SDR FEY · Pacote completo", subtitle: `Gerado em ${stampTime()} · até 1.500 linhas por base (o Excel traz tudo)`, sections: secs }));
        } else {
          const files: Record<string, Uint8Array> = {};
          for (const k of allowed) {
            const t = await tableOf(all(k), EX_MAX_ROWS);
            const q = (v: string) => csvEscape(v, ";");
            files[`${t.ds.label}.csv`] = strToU8("\uFEFF" + [t.cols.map((x) => q(x.label)).join(";"), ...t.rows.map((r) => r.map(q).join(";"))].join("\r\n"));
          }
          c.enqueue(zipSync(files));
        }
        c.close();
      } catch (e) { c.error(e); }
    } });
    return { stream, filename: `sdrfey-pacote-completo-${stamp()}.${format === "pdf" ? "pdf" : "zip"}`, mime: format === "pdf" ? "application/pdf" : "application/zip" };
  }
  const pass = new PassThrough();
  const sheets: Sheet[] = allowed.map((k) => ({ name: EX_BY_KEY.get(k)!.label, req: all(k) }));
  xlsx(pass, sheets, { title: "SDR FEY · Pacote completo", summary: true }).catch((e) => pass.destroy(e as Error));
  return { stream: Readable.toWeb(pass) as ReadableStream<Uint8Array>, filename: `sdrfey-pacote-completo-${stamp()}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

/** Contagem e amostra para a prévia da tela. */
export async function previewOf(req: ExRequest) {
  const ds = EX_BY_KEY.get(req.dataset)!;
  const cols = req.columns.map((k) => ds.columns.find((c) => c.key === k)!);
  const { where } = conditions(req.dataset, req.filters);
  const total = await countRows(req.dataset, where);
  const rows = total ? [...(await db.execute<Record<string, unknown>>(selectSql(req.dataset, cols.map((c) => c.key), where, { limit: 8, sort: req.sort })))] : [];
  const sample = rows.map((r) => cols.map((c) => { const v = coerce(r[c.key], c.kind); const p = plain(v, c.kind); return p === null ? "" : typeof p === "boolean" ? (p ? "SIM" : "NÃO") : c.kind === "money" && typeof p === "number" ? p.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(p); }));
  return { total, headers: cols.map((c) => c.label), sample };
}
