import { headerKey } from "./normalize";

export type CheckLevel = "bad" | "warn" | "info" | "ok";
export type Check = { level: CheckLevel; text: string };
export type FileInsight = {
  fileName: string;
  sizeKb: number;
  totalRows: number;
  columns: { name: string; field: string | null; filled: number }[];
  unknown: string[];
  missingOptional: string[];
  sample: { headers: string[]; rows: string[][] };
  checks: Check[];
};

/** Resume o arquivo para a prévia: colunas reconhecidas e quanto cada uma está preenchida, colunas ignoradas, amostra das primeiras linhas. */
export function inspectFile(opts: {
  fileName: string; size: number; headers: string[]; rows: Record<string, string>[];
  spec: Record<string, readonly string[]>; labels: Record<string, string>; optional?: string[];
}): Omit<FileInsight, "checks"> {
  const byAlias = new Map<string, string>();
  for (const [f, aliases] of Object.entries(opts.spec)) for (const a of aliases) if (!byAlias.has(a)) byAlias.set(a, f);
  const columns = opts.headers.map((h) => {
    const field = byAlias.get(headerKey(h)) ?? null;
    const filled = opts.rows.reduce((a, r) => a + ((r[h] ?? "").trim() ? 1 : 0), 0);
    return { name: h, field: field ? (opts.labels[field] ?? field) : null, filled };
  });
  const found = new Set(columns.map((c) => c.field).filter(Boolean));
  return {
    fileName: opts.fileName,
    sizeKb: Math.max(1, Math.round(opts.size / 1024)),
    totalRows: opts.rows.length,
    columns,
    unknown: columns.filter((c) => !c.field && c.name.trim()).map((c) => c.name),
    missingOptional: (opts.optional ?? []).filter((l) => !found.has(l)),
    sample: { headers: opts.headers, rows: opts.rows.slice(0, 8).map((r) => opts.headers.map((h) => (r[h] ?? "").slice(0, 60))) },
  };
}

/** Avisos comuns a qualquer importação. */
export function commonChecks(i: Omit<FileInsight, "checks">, o: { rejected: number; valid: number }, bigRows = 20000): Check[] {
  const c: Check[] = [];
  if (i.columns.length <= 1) c.push({ level: "bad", text: "O arquivo tem uma coluna só. O separador pode estar errado (use vírgula ou ponto e vírgula)." });
  if (i.totalRows === 0) c.push({ level: "bad", text: "O arquivo não tem nenhuma linha de dados." });
  if (i.totalRows > bigRows) c.push({ level: "warn", text: `Arquivo muito grande (${i.totalRows.toLocaleString("pt-BR")} linhas). Considere dividir em partes.` });
  const pct = i.totalRows ? Math.round((o.rejected / i.totalRows) * 100) : 0;
  if (pct >= 30) c.push({ level: "bad", text: `${pct}% das linhas foram rejeitadas. Provavelmente o tipo de importação ou as colunas estão erradas.` });
  else if (pct >= 10) c.push({ level: "warn", text: `${pct}% das linhas foram rejeitadas. Confira a lista de rejeitadas abaixo.` });
  if (i.unknown.length) c.push({ level: "info", text: `${i.unknown.length} coluna(s) não reconhecida(s) serão ignoradas: ${i.unknown.slice(0, 8).join(", ")}${i.unknown.length > 8 ? "…" : ""}.` });
  const empty = i.columns.filter((x) => x.field && x.filled === 0).map((x) => x.field);
  if (empty.length) c.push({ level: "warn", text: `Colunas reconhecidas, mas totalmente vazias: ${empty.join(", ")}.` });
  if (!c.some((x) => x.level === "bad" || x.level === "warn")) c.push({ level: "ok", text: "Nenhum problema encontrado nas colunas e nas linhas." });
  return c;
}

export const LEAD_LABELS: Record<string, string> = { cnpj: "CNPJ", company: "Empresa", sapCode: "Código SAP", contact: "Contato", phone: "Telefone", role: "Cargo", email: "E-mail", notes: "Observações", temperature: "Tag Temperatura", channel: "Tag Meio de contato", qualified: "Tag Qualificação", scheduled: "Agendado", status: "Tag Situação", owner: "Responsável (SDR)", visit: "Visita", size: "Tag Porte", capital: "Tag Capital", updatedAt: "Atualizado em", served: "Vezes sorteado" };
export const REP_LABELS: Record<string, string> = { esc: "ESC", manager: "Gestor", team: "Equipe", sapCode: "Código SAP", cnpj: "CNPJ", address: "Endereço", cep: "CEP", city: "Cidade", uf: "UF", repName: "Nome do representante", active: "Ativo" };
export const DEAL_LABELS: Record<string, string> = { cnpj: "CNPJ", company: "Empresa", contact: "Contato", phone: "Telefone", email: "E-mail", city: "Cidade", uf: "UF", sapCode: "Código SAP", stage: "Etapa", freight: "Frete", paymentTerms: "Condição de pagamento", quoteNumber: "Nº da cotação", quoteDate: "Data da cotação", quoteValue: "Valor da cotação", netValue: "Valor sem impostos", orderNumber: "Nº do pedido", closedOn: "Data de fechamento", closedValue: "Valor fechado", realValue: "Valor real", reactivation: "Reativação", lostReason: "Motivo da perda", nextAt: "Próximo contato", note: "Observação" };

export const CARRIER_LABELS: Record<string, string> = { uf: "UF", mode: "Tipo de frete", name: "Transportadora", capitalPct: "% Capital", interiorPct: "% Interior", capitalDays: "Dias Capital", interiorDays: "Dias Interior", minCents: "Frete mínimo", contact: "Contato", note: "Observação" };
