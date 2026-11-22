import { TAG } from "@/config/tags";
import { LEAD_COLUMNS, mapColumns, type LeadField } from "./columns";
import {
  cleanText,
  normalizeCnpj,
  normalizeEmail,
  parseLegacyDate,
  parseMoney,
  slugify,
  splitList,
  splitPhones,
} from "./normalize";

export type TagRef = { group: string; key: string; label?: string; sort?: number };

export type LeadDraft = {
  cnpj: string;
  company: string;
  sapCode: string | null;
  contactName: string | null;
  roleTitle: string | null;
  phones: string[];
  email: string | null;
  /** Todos os e-mails encontrados (inclui o principal); colunas repetidas são juntadas. */
  emails?: string[];
  notes: string | null;
  legacyVisit: string | null;
  /** Nome escrito na coluna de responsável (resolvido para usuário na hora de gravar). */
  ownerName: string | null;
  tags: TagRef[];
  timesServed: number;
  timesWorked: number;
  updatedAt: Date | null;
};

export type ImportReport = {
  total: number;
  valid: number;
  duplicatesInFile: number;
  rejected: { line: number; company: string; reason: string }[];
  /** Colunas importantes que não foram encontradas no arquivo. */
  missingColumns: string[];
  /** Quantas correções automáticas foram feitas, por tipo. */
  fixes: Record<string, number>;
  warnings: string[];
};

/* ───── Valores da planilha antiga → tags novas ───── */

const TEMPERATURE: Record<string, string> = { FRIO: "frio", MORNO: "morno", QUENTE: "quente" };
const CHANNEL: Record<string, string> = {
  LIGACAO: "ligacao",
  "LIGAÇÃO": "ligacao",
  WPP: "whatsapp",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  "E-MAIL": "email",
  PESSOALMENTE: "pessoalmente",
  REPRESENTANTE: "representante",
  BOT: "bot",
};
const STATUS: Record<string, string> = {
  "SEM CONTATO": "sem_contato",
  ATENDENDO: "conversando",
  CONVERSANDO: "conversando",
  CLIENTE: "cliente",
  CONTABILIDADE: "contabilidade",
  INAPTA: "inapta",
  BAIXADA: "baixada",
  SUSPENSA: "suspensa",
  "AUTO DESCARTE": "auto_descarte",
  "TELEFONE ERRADO": "telefone_errado",
  "EMAIL ERRADO": "email_errado",
  "DADOS ERRADOS": "dados_errados",
  INEXISTENTE: "inexistente",
};
/** Situações que só o robô colocava na planilha antiga. */
const BOT_STATUS = new Set(["auto_descarte"]);
const HUMAN_STATUS = new Set(["sem_contato", "conversando", "cliente"]);

const isYes = (v: string | null) => /^(SIM|S|YES|1|TRUE|X)$/i.test((v ?? "").trim());
const isNo = (v: string | null) => /^(N[AÃ]O|N|NO|0|FALSE)$/i.test((v ?? "").trim());

/**
 * Transforma as linhas do CSV em leads limpos. Não mexe no banco.
 * Aceita tanto o formato antigo (DB_LD) quanto um CSV simples só com EMPRESA, CNPJ, TELEFONE, EMAIL...
 */
export function parseLeadRows(
  headers: string[],
  rows: Record<string, string>[],
): { drafts: LeadDraft[]; report: ImportReport } {
  const cols = mapColumns<LeadField>(headers, LEAD_COLUMNS);
  const report: ImportReport = {
    total: rows.length,
    valid: 0,
    duplicatesInFile: 0,
    rejected: [],
    missingColumns: [],
    fixes: {},
    warnings: [],
  };
  const fix = (name: string, n = 1) => (report.fixes[name] = (report.fixes[name] ?? 0) + n);
  const warnedUnknown = new Set<string>();
  const warnUnknown = (kind: string, value: string) => {
    const k = `${kind}:${value}`;
    if (warnedUnknown.has(k)) return;
    warnedUnknown.add(k);
    report.warnings.push(`${kind} desconhecido(a) ignorado(a): "${value}"`);
  };

  if (!cols.cnpj) report.missingColumns.push("CNPJ");
  if (!cols.company) report.missingColumns.push("EMPRESA");
  if (report.missingColumns.length) return { drafts: [], report };

  const get = (row: Record<string, string>, f: LeadField) => (cols[f] ? cleanText(row[cols[f]!]) : null);
  const seen = new Set<string>();
  const drafts: LeadDraft[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // linha 1 é o cabeçalho
    const company = get(row, "company");
    const { cnpj, padded } = normalizeCnpj(get(row, "cnpj"));

    if (!cnpj) {
      report.rejected.push({ line, company: company ?? "", reason: "CNPJ inválido ou vazio" });
      return;
    }
    if (!company) {
      report.rejected.push({ line, company: "", reason: "Empresa sem nome" });
      return;
    }
    if (seen.has(cnpj)) {
      report.duplicatesInFile++;
      return;
    }
    seen.add(cnpj);
    if (padded) fix("cnpjComZeroRestaurado");

    /* contatos */
    const { phones, fixed } = splitPhones(get(row, "phone"));
    if (fixed) fix("celularesComNoveDigitoCorrigidos", fixed);
    const email = normalizeEmail(get(row, "email"));
    const emails = [...new Set(String(get(row, "email") ?? "").split(/[;,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))];

    /* tags */
    const tags: TagRef[] = [];
    const add = (group: string, key: string, extra?: Partial<TagRef>) => {
      if (!tags.some((t) => t.group === group && t.key === key)) tags.push({ group, key, ...extra });
    };

    for (const t of splitList(get(row, "temperature"))) {
      TEMPERATURE[t] ? add(TAG.group.temperatura, TEMPERATURE[t]) : warnUnknown("Temperatura", t);
    }
    for (const t of splitList(get(row, "channel"))) {
      CHANNEL[t] ? add(TAG.group.meio, CHANNEL[t]) : warnUnknown("Meio de contato", t);
    }
    const qualified = get(row, "qualified");
    if (isYes(qualified)) add(TAG.group.qualificacao, TAG.qualificado);
    else if (isNo(qualified)) add(TAG.group.qualificacao, TAG.desqualificado);
    if (isYes(get(row, "scheduled"))) add(TAG.group.agenda, TAG.agendado);
    for (const t of splitList(get(row, "status"))) {
      STATUS[t] ? add(TAG.group.situacao, STATUS[t]) : warnUnknown("Situação", t);
    }
    const size = get(row, "size");
    if (size) add(TAG.group.porte, slugify(size), { label: size.toUpperCase() });
    const capital = get(row, "capital");
    if (capital) add(TAG.group.capital, slugify(capital), { label: capital, sort: parseMoney(capital) });

    /* responsável */
    let ownerName = get(row, "owner")?.toUpperCase() ?? null;
    if (ownerName && !/^[A-ZÀ-Ü][A-ZÀ-Ü .'-]*$/.test(ownerName)) {
      fix("responsavelInvalidoLimpo"); // ex.: "#REF!"
      ownerName = null;
    }
    const ownerIsBot = ownerName === "AUTO";
    if (ownerIsBot) ownerName = null;

    /* Contabilidade não descarta mais: quem o robô descartou SÓ por isso volta para o sorteio. */
    const statusKeys = tags.filter((t) => t.group === TAG.group.situacao).map((t) => t.key);
    if (ownerIsBot && statusKeys.length > 0 && statusKeys.every((k) => k === TAG.contabilidade)) {
      const before = tags.length;
      for (const drop of [
        (t: TagRef) => t.group === TAG.group.qualificacao && t.key === TAG.desqualificado,
        (t: TagRef) => t.group === TAG.group.meio && t.key === TAG.bot,
      ]) {
        const idx = tags.findIndex(drop);
        if (idx >= 0) tags.splice(idx, 1);
      }
      if (tags.length !== before) fix("contabilidadeReativados");
    }

    const notes = get(row, "notes");
    const humanChannel = tags.some((t) => t.group === TAG.group.meio && t.key !== TAG.bot);
    const humanStatus = statusKeys.some((k) => HUMAN_STATUS.has(k) && !BOT_STATUS.has(k));
    const worked =
      tags.some((t) => t.group === TAG.group.temperatura) ||
      humanChannel ||
      humanStatus ||
      tags.some((t) => t.group === TAG.group.agenda) ||
      isYes(qualified) ||
      !!notes ||
      (!!ownerName && !ownerIsBot);
    const served = worked || isYes(get(row, "served"));

    drafts.push({
      cnpj,
      company,
      sapCode: get(row, "sapCode"),
      contactName: get(row, "contact"),
      roleTitle: get(row, "role"),
      phones,
      email,
      emails,
      notes,
      legacyVisit: get(row, "visit"),
      ownerName,
      tags,
      timesServed: served ? 1 : 0,
      timesWorked: worked ? 1 : 0,
      updatedAt: parseLegacyDate(get(row, "updatedAt")),
    });
  });

  report.valid = drafts.length;
  return { drafts, report };
}
