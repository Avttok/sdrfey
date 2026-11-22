import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** PDF: no máximo estas linhas por tabela (acima disso a planilha é o formato certo). */
export const PDF_MAX_ROWS = 5000;

export type PdfSection = { name: string; headers: string[]; rows: string[][]; /** colunas alinhadas à direita (números) */ right?: boolean[]; note?: string };
export type PdfInput = { title: string; subtitle?: string; summary?: [string, string][]; sections: PdfSection[] };

const W = 842, H = 595, M = 30, ROW = 14, HEAD = 18, SIZE = 7.5;
const ACC = rgb(0.31, 0.275, 0.9), INK = rgb(0.12, 0.16, 0.23), MUTED = rgb(0.4, 0.45, 0.53), ZEBRA = rgb(0.965, 0.97, 0.985), LINE = rgb(0.88, 0.9, 0.94);
const CP1252 = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);

/** A fonte padrão do PDF só entende Latin-1 (acentos do português incluídos); o resto vira "?". */
function safe(s: string): string {
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) { const c = ch.codePointAt(0)!; out += (c >= 32 && c < 127) || (c >= 160 && c <= 255) || CP1252.has(c) ? ch : c < 32 || (c >= 127 && c < 160) ? "" : "?"; }
  return out;
}
function fit(font: PDFFont, text: string, width: number, size: number): string {
  const t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  let lo = 0, hi = t.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (font.widthOfTextAtSize(t.slice(0, mid) + "…", size) <= width) lo = mid; else hi = mid - 1; }
  return t.slice(0, lo) + "…";
}

/** Larguras naturais por coluna e divisão em faixas que cabem na largura da página. */
function plan(font: PDFFont, bold: PDFFont, s: PdfSection): number[][] {
  const usable = W - 2 * M;
  const nat = s.headers.map((h, i) => {
    let w = bold.widthOfTextAtSize(safe(h), SIZE);
    for (const r of s.rows.slice(0, 80)) w = Math.max(w, font.widthOfTextAtSize(safe(r[i] ?? ""), SIZE));
    return Math.min(190, Math.max(38, w + 10));
  });
  const bands: number[][] = [];
  let cur: number[] = [], sum = 0;
  nat.forEach((w, i) => { if (cur.length && sum + w > usable) { bands.push(cur); cur = []; sum = 0; } cur.push(i); sum += w; });
  if (cur.length) bands.push(cur);
  return bands.map((b) => b);
}

export async function buildPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(input.title)); doc.setCreator("SDR FEY"); doc.setProducer("SDR FEY");
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date());
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (t: string, x: number, yy: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => page.drawText(safe(t), { x, y: yy, font: o.f ?? font, size: o.size ?? SIZE, color: o.color ?? INK });
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };

  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: ACC });
  text(input.title, M, H - 34, { f: bold, size: 20, color: rgb(1, 1, 1) });
  text(input.subtitle ?? `Gerado em ${when}`, M, H - 52, { size: 9, color: rgb(0.9, 0.92, 1) });
  y = H - 64 - 22;
  if (input.summary?.length) {
    for (const [k, v] of input.summary) { if (y < M + 40) newPage(); text(k, M, y, { f: bold, size: 9 }); text(v, M + 190, y, { size: 9, color: MUTED }); y -= 14; }
    y -= 8;
  }

  for (const s of input.sections) {
    const bands = plan(font, bold, s);
    bands.forEach((band, bi) => {
      if (y < M + 90) newPage();
      const label = `${s.name} · ${s.rows.length.toLocaleString("pt-BR")} linha${s.rows.length === 1 ? "" : "s"}${bands.length > 1 ? ` · colunas ${band[0] + 1} a ${band[band.length - 1] + 1} de ${s.headers.length}` : ""}`;
      text(label, M, y, { f: bold, size: 11, color: ACC }); y -= 6;
      if (s.note && bi === 0) { y -= 10; text(s.note, M, y, { size: 8, color: MUTED }); }
      y -= 8;
      const nat = band.map((i) => { let w = bold.widthOfTextAtSize(safe(s.headers[i]), SIZE); for (const r of s.rows.slice(0, 80)) w = Math.max(w, font.widthOfTextAtSize(safe(r[i] ?? ""), SIZE)); return Math.min(190, Math.max(38, w + 10)); });
      const k = Math.min(1.5, (W - 2 * M) / nat.reduce((a, b) => a + b, 0));
      const ws = nat.map((w) => w * k);
      const header = () => {
        page.drawRectangle({ x: M, y: y - HEAD + 4, width: ws.reduce((a, b) => a + b, 0), height: HEAD, color: INK });
        let x = M;
        band.forEach((c, j) => { text(fit(bold, s.headers[c], ws[j] - 8, SIZE), x + 4, y - 8, { f: bold, color: rgb(1, 1, 1) }); x += ws[j]; });
        y -= HEAD;
      };
      header();
      s.rows.forEach((r, ri) => {
        if (y < M + 24) { newPage(); header(); }
        if (ri % 2) page.drawRectangle({ x: M, y: y - ROW + 4, width: ws.reduce((a, b) => a + b, 0), height: ROW, color: ZEBRA });
        let x = M;
        band.forEach((c, j) => {
          const t = fit(font, r[c] ?? "", ws[j] - 8, SIZE);
          text(t, s.right?.[c] ? x + ws[j] - 4 - font.widthOfTextAtSize(t, SIZE) : x + 4, y - 7);
          x += ws[j];
        });
        page.drawLine({ start: { x: M, y: y - ROW + 4 }, end: { x: M + ws.reduce((a, b) => a + b, 0), y: y - ROW + 4 }, thickness: 0.3, color: LINE });
        y -= ROW;
      });
      if (!s.rows.length) { text("Nenhum registro.", M + 4, y - 7, { size: 8, color: MUTED }); y -= ROW; }
      y -= 22;
    });
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`SDR FEY · ${when}`, { x: M, y: 14, size: 7, font, color: MUTED });
    const t = `Página ${i + 1} de ${pages.length}`;
    p.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 7), y: 14, size: 7, font, color: MUTED });
  });
  return doc.save();
}
