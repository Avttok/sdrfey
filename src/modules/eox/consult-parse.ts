import { parsePhones } from "@/modules/enrich/parse";

/** Parte pura da Consulta EOX (sem rede e sem banco): transforma o cadastro da EOX no que o lead pode receber. */
export type EoxRow = Record<string, unknown>;
export type EoxPerson = { name: string; title: string | null; phones: string[]; emails: string[] };
export type EoxFound = {
  tradeName: string | null; site: string | null; address: string | null; neighborhood: string | null; zip: string | null; city: string | null; uf: string | null; contactName: string | null;
  phones: string[]; emails: string[]; people: EoxPerson[];
  /** tipo de cada telefone vindo da lista "Telefones" da EOX (dígitos → Fixo, Celular, WhatsApp…) */
  phoneKinds: Record<string, string>;
  /** retrato legível (rótulo → valor), guardado em leads.eox_info */
  info: Record<string, string>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown): string => {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  return /^0000-00-00/.test(s) ? "" : s;
};
export const emailsIn = (raw: unknown): string[] => [...new Set(clean(raw).split(/[\s,;/]+/).map((x) => x.toLowerCase()).filter((x) => EMAIL.test(x)))];
const phonesIn = (raw: unknown) => parsePhones(clean(raw));
/** Campo de telefone pelo rótulo (os campos criados pela Fey têm nomes como cf_123): exclui fax, ramal e DDD soltos. */
const PHONE_LABEL = /telefone|celular|whats|fone|\btel\b/i;
const NOT_PHONE = /fax|ramal|\bddd\b|bloque|discag|data|hora/i;
const EMAIL_LABEL = /e-?mail/i;
const NOT_EMAIL = /enviar|bloque|opt|data|hora|status|situa/i;
const SITE_LABEL = /^(web ?)?site$|^website$/i;
/** Nomes internos que a EOX da Fey usa (vistos no perfil do cliente), para quando o "describe" não vier. */
export const KNOWN_LABELS: Record<string, string> = {
  id_erp_original: "Cód Cliente ERP", cnpj: "CNPJ/CPF", id_erp: "Cód Cliente", accountname: "Nome da Empresa", phone: "Telefone", nome_fantasia: "Nome Fantasia",
  rating: "Avaliação", email1: "Email", accounttype: "Tipo", assigned_user_id: "Responsável", frequencia_cotacoes: "Frequência de Cotações", canal_compra: "Canal de Compra",
  bill_city: "Cidade Faturamento", bill_state: "Estado Faturamento", segmento: "Segmento",
};
/** Tipos da lista "Telefones" da EOX (valor interno → rótulo). */
export const PHONE_KIND: Record<string, string> = { Phone: "Fixo", "Other Phone": "Outro Telefone", WhatsApp: "WhatsApp", Mobile: "Celular", "Telefone Alternativo": "Telefone Alternativo", "Office Phone": "Telefone Escritório" };
const lab = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const INFO_SKIP = /^(id|modifiedby|createdby|created_user_id|source|starred|tags|label|imagename|isconvertedfromlead|notify_owner|emailoptout|isduplicatable|record_id)$/i;

/**
 * `labels` vem do "describe" da EOX (nome interno → rótulo). Sem ele, só valem os nomes padrão do Vtiger.
 * Nunca inventa: o que a EOX não tem fica nulo.
 */
export function mapAccount(row: EoxRow, labels: Map<string, string>, contacts: EoxRow[] = [], phoneRows: { value: string; type: string | null }[] = []): EoxFound {
  const phones: string[] = [], emails: string[] = [];
  const info: Record<string, string> = {};
  const byLabel: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const val = clean(v);
    if (!val) continue;
    const label = labels.get(k) ?? KNOWN_LABELS[k] ?? k;
    byLabel[lab(label)] = val;
    if (!INFO_SKIP.test(k) && val.length <= 300 && !/^\d+x\d+$/.test(val)) info[label] = val;
    const std = k === "phone" || k === "otherphone" || k === "mobile";
    if (std || (PHONE_LABEL.test(label) && !NOT_PHONE.test(label))) phones.push(...phonesIn(val));
    const stdMail = k === "email1" || k === "email2" || k === "email";
    if (stdMail || (EMAIL_LABEL.test(label) && !NOT_EMAIL.test(label))) emails.push(...emailsIn(val));
  }
  const people: EoxPerson[] = [];
  for (const c of contacts) {
    const name = [clean(c.firstname), clean(c.lastname)].filter(Boolean).join(" ") || clean(c.name);
    if (!name) continue;
    const cp = [...phonesIn(c.mobile), ...phonesIn(c.phone), ...phonesIn(c.homephone), ...phonesIn(c.otherphone)];
    const ce = [...emailsIn(c.email), ...emailsIn(c.secondaryemail)];
    people.push({ name: name.slice(0, 120), title: clean(c.title) || clean(c.department) || null, phones: [...new Set(cp)], emails: [...new Set(ce)] });
  }
  const phoneKinds: Record<string, string> = {};
  for (const pr of phoneRows) for (const d of phonesIn(pr.value)) { phones.push(d); const k = pr.type ? PHONE_KIND[pr.type] ?? pr.type : ""; if (k) phoneKinds[d] = k; }
  const site = clean(row.website) || byLabel["website"] || byLabel["site"] || "";
  const street = clean(row.bill_street) || byLabel["endereco faturamento"] || "";
  const num = byLabel["numero faturamento"] ?? "", comp = byLabel["complemento faturamento"] ?? "";
  const address = [street, num && num !== "0" && !street.includes(num) ? num : "", comp].filter(Boolean).join(", ");
  const uf = (clean(row.bill_state) || byLabel["estado faturamento"] || "").toUpperCase();
  const zip = (clean(row.bill_code) || byLabel["cep faturamento"] || "").replace(/\D/g, "");
  return {
    tradeName: null, // a EOX corta o nome fantasia em 10 letras ("JOSE GUILH"): só vai para o retrato, nunca para o lead
    site: site || null,
    address: address || null,
    neighborhood: byLabel["bairro faturamento"] || null,
    zip: zip.length === 8 ? zip.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
    city: clean(row.bill_city) || byLabel["cidade faturamento"] || null,
    uf: /^[A-Z]{2}$/.test(uf) ? uf : null,
    contactName: people[0]?.name ?? null,
    phones: [...new Set(phones)],
    emails: [...new Set(emails)],
    people: people.slice(0, 15),
    phoneKinds,
    info,
  };
}
