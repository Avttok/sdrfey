import type { SheetInfo } from "./sheets";

type Item = { str: string; x: number; y: number; w: number };
const esc = (s: string) => (/[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Agrupa os pedaços de texto de uma página em linhas (mesma altura) e as linhas em células (separadas por vão). */
type Cell = { x: number; text: string };
function pageRows(items: Item[]): Cell[][] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Item[][] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= 2.5) last.push(it); else lines.push([it]);
  }
  return lines.map((l) => {
    l.sort((a, b) => a.x - b.x);
    const cells: { x: number; text: string; end: number }[] = [];
    for (const it of l) {
      const c = cells[cells.length - 1];
      if (c && it.x - c.end < 4.5) { c.text += (it.x - c.end > 1 ? " " : "") + it.str; c.end = it.x + it.w; }
      else cells.push({ x: it.x, text: it.str, end: it.x + it.w });
    }
    return cells.map(({ x, text }) => ({ x, text: text.trim() }));
  });
}

/**
 * Lê as tabelas de um PDF com texto selecionável (como os que o próprio sistema gera): a primeira linha com mais colunas
 * vira o cabeçalho; as demais linhas são encaixadas na coluna cujo início está mais perto. Cabeçalhos repetidos em cada página são ignorados.
 */
export async function readPdfTables(buf: ArrayBuffer, maxRows: number): Promise<SheetInfo[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const all: Cell[][] = [];
  for (let p = 1; p <= pdf.numPages && all.length <= maxRows + 50; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const it of tc.items as { str?: string; transform?: number[]; width?: number }[]) if (typeof it.str === "string" && it.transform) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 });
    const rows = pageRows(items);
    // rodapé do sistema ("SDR FEY · data" e "Página x de y") não é dado
    all.push(...rows.filter((r) => !/^(SDR FEY ·|Página \d+ de \d+)/.test(r[0]?.text ?? "")));
  }
  if (!all.length) return [];
  const HEADING = /^(.+?) · [\d.]+ linhas? ?(?:· colunas (\d+) a (\d+) de (\d+))?$/;
  const headingOf = (r: Cell[]) => (r.length === 1 ? HEADING.exec(r[0].text) : null);
  const isNote = (r: Cell[]) => r.length === 1 && /^Mostrando as primeiras/.test(r[0].text);

  /** Uma tabela a partir das linhas: o cabeçalho é a primeira linha larga; linhas repetidas do cabeçalho (outras páginas) saem. */
  const toTable = (rows: Cell[][]) => {
    const rs = rows.filter((r) => !isNote(r));
    const widest = Math.max(0, ...rs.slice(0, 12).map((x) => x.length));
    const hi = rs.findIndex((r) => r.length >= 2 && r.length >= widest);
    if (hi < 0) return null;
    const head = rs[hi], starts = head.map((c) => c.x), headers = head.map((c) => c.text), sig = headers.join("|");
    const data: string[][] = [];
    for (const r of rs.slice(hi + 1)) {
      if (r.map((c) => c.text).join("|") === sig) continue;
      const row = Array<string>(starts.length).fill("");
      for (const c of r) {
        let best = 0, d = Infinity;
        starts.forEach((st, i) => { const dd = Math.abs(c.x - st); if (dd < d) { d = dd; best = i; } });
        row[best] = row[best] ? `${row[best]} ${c.text}` : c.text;
      }
      if (row.some(Boolean)) data.push(row);
      if (data.length >= maxRows) break;
    }
    return { headers, data };
  };

  const blocks: { name: string; band: boolean; rows: Cell[][] }[] = [];
  for (const r of all) { const h = headingOf(r); if (h) blocks.push({ name: h[1], band: !!h[2], rows: [] }); else if (blocks.length) blocks[blocks.length - 1].rows.push(r); }
  const tables: { name: string; headers: string[]; data: string[][] }[] = [];
  if (blocks.length) {
    // PDF do próprio sistema: faixas de colunas da mesma tabela voltam a ser uma só
    for (const b of blocks) {
      const t = toTable(b.rows); if (!t) continue;
      const prev = tables[tables.length - 1];
      if (b.band && prev && prev.name === b.name) {
        prev.headers.push(...t.headers);
        const n = Math.max(prev.data.length, t.data.length);
        for (let i = 0; i < n; i++) prev.data[i] = [...(prev.data[i] ?? Array(prev.headers.length - t.headers.length).fill("")), ...(t.data[i] ?? Array(t.headers.length).fill(""))];
      } else tables.push({ name: b.name, headers: t.headers, data: t.data });
    }
  } else {
    const t = toTable(all.filter((r) => !(r.length === 1 && r[0].text.includes(" · ") && /linha/.test(r[0].text))));
    if (t) tables.push({ name: "PDF", ...t });
  }
  return tables.filter((t) => t.data.length).map((t) => ({ name: t.name.slice(0, 31), rows: t.data.length, cols: t.headers.length, csv: [t.headers, ...t.data].map((l) => l.map(esc).join(",")).join("\n") }));
}
