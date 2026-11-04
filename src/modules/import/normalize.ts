/** Funções pequenas e puras de limpeza de dados. Sem banco, fáceis de testar. */

export const onlyDigits = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Texto sem espaços sobrando; vazio vira null. */
export function cleanText(v: unknown): string | null {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Nome de coluna comparável: "OBSERVAÇÃO" → "OBSERVACAO", "COD SAP" → "CODSAP". */
export function headerKey(h: string): string {
  return stripAccents(h).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Separa listas como "WPP, EMAIL" ou "SEM CONTATO, ATENDENDO" em itens maiúsculos. */
export function splitList(v: unknown): string[] {
  return String(v ?? "")
    .split(/[,;]/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

/* ───── CNPJ ───── */

export function normalizeCnpj(v: unknown): { cnpj: string | null; padded: boolean } {
  let d = onlyDigits(v);
  let padded = false;
  // Excel costuma comer os zeros à esquerda.
  if (d.length >= 12 && d.length < 14) {
    d = d.padStart(14, "0");
    padded = true;
  }
  return { cnpj: d.length === 14 ? d : null, padded };
}

export function isValidCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function formatCnpj(d: string): string {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/* ───── Telefone ───── */

/**
 * Devolve telefones só com dígitos (DDD + número), sem repetição.
 * - tira o 55 do país e zeros à esquerda;
 * - descarta números inválidos (tamanho errado ou todos iguais);
 * - celular antigo de 8 dígitos (ex.: 47 9159-8777) ganha o 9 na frente (47 99159-8777).
 */
export function splitPhones(v: unknown): { phones: string[]; fixed: number } {
  const out: string[] = [];
  let fixed = 0;
  for (const part of String(v ?? "").split(/[\/;,|\n]+/)) {
    let d = onlyDigits(part);
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    d = d.replace(/^0+/, "");
    if (d.length !== 10 && d.length !== 11) continue;
    if (/^(\d)\1+$/.test(d)) continue;
    if (d.length === 10 && "6789".includes(d[2])) {
      d = d.slice(0, 2) + "9" + d.slice(2);
      fixed++;
    }
    if (!out.includes(d)) out.push(d);
  }
  return { phones: out, fixed };
}

export function formatPhone(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Número no formato do ChatPro/WhatsApp: 55 + DDD + número. */
export function whatsappNumber(d: string): string {
  return `55${d}`;
}

/* ───── Email e datas ───── */

export function normalizeEmail(v: unknown): string | null {
  const first = String(v ?? "")
    .split(/[;,\s]+/)
    .map((x) => x.trim().toLowerCase())
    .find((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  return first ?? null;
}

/** "25-10-2026 17:49:00" (horário de Brasília) → Date. */
export function parseLegacyDate(v: unknown): Date | null {
  const m = String(v ?? "")
    .trim()
    .match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "R$ 10.000" → 10000 (para ordenar tags de capital). */
export function parseMoney(v: unknown): number {
  return Number(onlyDigits(v)) || 0;
}
