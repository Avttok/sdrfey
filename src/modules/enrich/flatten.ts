/** Transforma a resposta crua de uma consulta em linhas "rótulo: valor", sem nada vazio (null, "", [], {}). */
export type RawRow = { label: string; value: string };

const humanize = (k: string) => { const t = k.replace(/_/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

export function flattenRaw(data: unknown, path: string[] = []): RawRow[] {
  if (data === null || data === undefined) return [];
  if (typeof data === "string") return data.trim() === "" ? [] : [{ label: path.join(" › "), value: data.trim() }];
  if (typeof data === "number") return [{ label: path.join(" › "), value: String(data) }];
  if (typeof data === "boolean") return [{ label: path.join(" › "), value: data ? "Sim" : "Não" }];
  if (Array.isArray(data)) return data.flatMap((item, i) => flattenRaw(item, [...path.slice(0, -1), `${path[path.length - 1] ?? "Item"} ${i + 1}`]));
  if (typeof data === "object") return Object.entries(data as Record<string, unknown>).flatMap(([k, v]) => flattenRaw(v, [...path, humanize(k)]));
  return [];
}

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const yn = (v: unknown) => (typeof v === "boolean" ? (v ? "Sim" : "Não") : null);
/** "2020-05-03" ou "03/05/2020" → "03/05/2020". */
const brDate = (v: unknown) => {
  const s = txt(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : s;
};
const cnae = (code: unknown, text: unknown) => {
  const c = txt(code)?.replace(/\D/g, "");
  if (c === "0" || c === "0000000") return txt(text);
  const f = c && c.length === 7 ? `${c.slice(0, 4)}-${c[4]}/${c.slice(5)}` : (txt(code) ?? null);
  return [f, txt(text)].filter(Boolean).join(" - ") || null;
};

/** As informações que a equipe quer ver, na ordem combinada, de uma fonte (BrasilAPI ou ReceitaWS). Só o que veio preenchido. */
export function selectedRows(source: "BrasilAPI" | "ReceitaWS", raw: any): RawRow[] {
  if (!raw || typeof raw !== "object") return [];
  const rows: RawRow[] = [];
  const add = (label: string, value: string | null) => { if (value) rows.push({ label, value }); };
  if (source === "BrasilAPI") {
    add("Tipo", txt(raw.descricao_identificacao_matriz_filial));
    add("Porte", txt(raw.descricao_porte) ?? txt(raw.porte));
    add("MEI", yn(raw.opcao_pelo_mei));
    add("Data MEI", brDate(raw.data_opcao_pelo_mei));
    add("SIMPLES", yn(raw.opcao_pelo_simples));
    add("Data SIMPLES", brDate(raw.data_opcao_pelo_simples));
    add("Data Situação", brDate(raw.data_situacao_cadastral));
    add("Atividade principal", cnae(raw.cnae_fiscal, raw.cnae_fiscal_descricao));
    (Array.isArray(raw.cnaes_secundarios) ? raw.cnaes_secundarios : []).forEach((a: any, i: number) => add(`Atividade secundária ${i + 1}`, cnae(a?.codigo, a?.descricao)));
    (Array.isArray(raw.qsa) ? raw.qsa : []).forEach((s: any, i: number) => add(`Sócio ${i + 1}`, [txt(s?.nome_socio), txt(s?.qualificacao_socio)].filter(Boolean).join(" — ") || null));
  } else {
    add("Tipo", txt(raw.tipo));
    add("Porte", txt(raw.porte));
    add("MEI", yn(raw.simei?.optante));
    add("Data MEI", brDate(raw.simei?.ultima_atualizacao));
    add("SIMPLES", yn(raw.simples?.optante));
    add("Data SIMPLES", brDate(raw.simples?.ultima_atualizacao));
    add("Data Situação", brDate(raw.data_situacao));
    const p = Array.isArray(raw.atividade_principal) ? raw.atividade_principal[0] : null;
    add("Atividade principal", cnae(p?.code, p?.text));
    (Array.isArray(raw.atividades_secundarias) ? raw.atividades_secundarias : []).forEach((a: any, i: number) => add(`Atividade secundária ${i + 1}`, cnae(a?.code, a?.text)));
    (Array.isArray(raw.qsa) ? raw.qsa : []).forEach((s: any, i: number) => add(`Sócio ${i + 1}`, [txt(s?.nome), txt(s?.qual)].filter(Boolean).join(" — ") || null));
  }
  return rows;
}
