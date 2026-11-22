import { headerKey } from "@/modules/import/normalize";
import { isMode, type FreightMode } from "@/config/carriers";
import { UFS } from "@/config/lists";

/** Nomes aceitos para cada coluna (sem acento, sem espaço, maiúsculo). */
export const CARRIER_COLUMNS = {
  uf: ["UF", "ESTADO"],
  mode: ["TIPO", "FRETE", "TIPOFRETE", "MODALIDADE", "CIFFOBRED"],
  name: ["TRANSPORTADORA", "NOME", "EMPRESA"],
  capitalPct: ["CAPITAL", "CAPITALPCT", "PCTCAPITAL", "FRETECAPITAL", "REGIAO1", "FRETEREGIAO1", "PCTREGIAO1"],
  interiorPct: ["INTERIOR", "INTERIORPCT", "PCTINTERIOR", "FRETEINTERIOR", "REGIAO2", "FRETEREGIAO2", "PCTREGIAO2"],
  capitalDays: ["DIASCAPITAL", "PRAZOCAPITAL", "DIASREGIAO1", "PRAZOREGIAO1"],
  interiorDays: ["DIASINTERIOR", "PRAZOINTERIOR", "DIASREGIAO2", "PRAZOREGIAO2"],
  minCents: ["MINIMO", "FRETEMINIMO", "MIN"],
  contact: ["CONTATO", "TELEFONE", "FONE"],
  note: ["OBSERVACAO", "OBS", "OBSERVACOES"],
} as const;
type Field = keyof typeof CARRIER_COLUMNS;

export type CarrierDraft = { uf: string; mode: FreightMode; name: string; capitalPct: number | null; interiorPct: number | null; capitalDays: number | null; interiorDays: number | null; minCents: number | null; contact: string | null; note: string | null };
export type CarrierParse = { drafts: CarrierDraft[]; warnings: string[]; missing: string[] };

const pctOf = (v: string | undefined) => { const t = (v ?? "").replace("%", "").replace(/\s/g, "").replace(/\./g, "").replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null; };
const intOf = (v: string | undefined) => { const n = parseInt((v ?? "").replace(/\D/g, ""), 10); return Number.isFinite(n) && n >= 0 && n <= 365 ? n : null; };
const centsOf = (v: string | undefined) => { const t = (v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; };

export function parseCarrierRows(headers: string[], rows: Record<string, string>[]): CarrierParse {
  const col = (f: Field) => headers.find((h) => (CARRIER_COLUMNS[f] as readonly string[]).includes(headerKey(h)));
  const c = Object.fromEntries((Object.keys(CARRIER_COLUMNS) as Field[]).map((f) => [f, col(f)])) as Record<Field, string | undefined>;
  const missing = (["uf", "mode", "name"] as Field[]).filter((f) => !c[f]).map((f) => ({ uf: "UF", mode: "Tipo (CIF/FOB/RED)", name: "Transportadora" }[f as "uf" | "mode" | "name"]));
  if (missing.length) return { drafts: [], warnings: [], missing };
  const warnings: string[] = [];
  const seen = new Map<string, CarrierDraft>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const uf = (r[c.uf!] ?? "").trim().toUpperCase();
    const mode = (r[c.mode!] ?? "").trim().toUpperCase().replace("REDESPACHO", "RED");
    const name = (r[c.name!] ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!uf && !mode && !name) return;
    if (!UFS.includes(uf)) return void warnings.push(`Linha ${line}: UF "${uf}" inválida.`);
    if (!isMode(mode)) return void warnings.push(`Linha ${line}: tipo "${mode}" inválido (use CIF, FOB ou RED).`);
    if (!name) return void warnings.push(`Linha ${line}: sem nome de transportadora.`);
    const g = (f: Field) => (c[f] ? r[c[f]!] : undefined);
    seen.set(`${uf}|${mode}|${name.toUpperCase()}`, { uf, mode, name, capitalPct: pctOf(g("capitalPct")), interiorPct: pctOf(g("interiorPct")), capitalDays: intOf(g("capitalDays")), interiorDays: intOf(g("interiorDays")), minCents: centsOf(g("minCents")), contact: (g("contact") ?? "").trim().slice(0, 120) || null, note: (g("note") ?? "").trim().slice(0, 400) || null });
  });
  const dups = rows.length - warnings.length - seen.size;
  if (dups > 0) warnings.push(`${dups} linha(s) repetida(s) (mesmo estado, tipo e transportadora): vale a última.`);
  return { drafts: [...seen.values()], warnings, missing: [] };
}

export const CARRIER_SAMPLE_CSV = "UF;Tipo;Transportadora;% Capital;% Interior;Dias Capital;Dias Interior;Frete mínimo;Contato;Obs\nSP;CIF;Rápido Sul;3,5;5,2;2;4;80,00;(11) 4000-0000;Coleta às terças\nMG;FOB;Transmineira;4,0;6,1;3;6;;;\nBA;RED;Bahia Cargas;5,5;8,0;5;9;120,00;;Redespacho em Salvador\n";
