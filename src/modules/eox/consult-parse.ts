import { EOX_FIELDS } from "@/config/eox-fields";
import { parsePhones } from "@/modules/enrich/parse";
import { CONSULT_DEFAULT, type ConsultOptions } from "./consult-options";

/** Parte pura da Consulta EOX (sem rede e sem banco): transforma o cadastro da EOX no que o lead pode receber. */
export type EoxRow = Record<string, unknown>;
export type EoxPerson = { name: string; title: string | null; phones: string[]; emails: string[] };
export type EoxFound = {
  site: string | null; facebook: string | null; linkedin: string | null;
  address: string | null; neighborhood: string | null; zip: string | null; city: string | null; uf: string | null;
  stateReg: string | null; contactName: string | null;
  phones: string[]; emails: string[]; people: EoxPerson[];
  /** tipo de cada telefone (dígitos → Fixo, Celular, WhatsApp…), vindo da lista "Telefones" ou do nome do campo */
  phoneKinds: Record<string, string>;
  /** ID EOX do cliente (Cód Cliente ERP), o mesmo que a planilha chama de IdEOX */
  code: string | null;
  /** retrato legível (rótulo → valor), guardado em leads.eox_info */
  info: Record<string, string>;
};

/** Tipos da lista "Telefones" da EOX (valor interno → rótulo). */
export const PHONE_KIND: Record<string, string> = { Phone: "Fixo", "Other Phone": "Outro Telefone", WhatsApp: "WhatsApp", Mobile: "Celular", "Telefone Alternativo": "Telefone Alternativo", "Office Phone": "Telefone Escritório" };
/** Campos do cadastro que guardam telefone (e o rótulo do canal quando o nome já diz o tipo). */
const PHONE_FIELDS: Record<string, string | null> = { phone: null, otherphone: "Outro Telefone", otherphone2: "Telefone Alternativo", otherphone3: "Telefone Alternativo", whatsapp: "WhatsApp" };
const EMAIL_FIELDS = ["email1", "email2"];
/** Nunca viram dado do cliente: ids internos, quem criou, e-mails do vendedor/gestor. */
const INFO_SKIP = new Set(["id", "modifiedby", "creator", "source", "starred", "tags", "label", "imagename", "isconvertedfromlead", "notify_owner", "emailoptout", "isduplicatable", "record_id", "email_vendedor", "email_gestor", "email_gerencia", "email_lider", "contact_owner_email", "bill_atualizar_coordenada", "account_id", "carteira_destino", "carteira_original", "transferenciacarteiraid"]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown): string => {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  return /^0000-00-00/.test(s) ? "" : s;
};
export const emailsIn = (raw: unknown): string[] => [...new Set(clean(raw).split(/[\s,;/]+/).map((x) => x.toLowerCase()).filter((x) => EMAIL.test(x)))];
const phonesIn = (raw: unknown) => parsePhones(clean(raw));
const url = (v: string): string | null => { const t = v.trim(); return t && /\.[a-z]{2,}/i.test(t) ? t : null; };

/** Valor como a tela da EOX mostra: data dd-mm-aaaa, dinheiro 1.234,56, sim/não. Uma data/zero vazio vira "". */
export function showValue(type: string, raw: string): string {
  if (type === "date" || type === "datetime") {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/.exec(raw);
    return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] && type === "datetime" ? ` ${m[4]}` : ""}` : raw;
  }
  if (type === "currency" || type === "double") {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: type === "currency" ? 2 : 0, maximumFractionDigits: 2 }) : raw;
  }
  if (type === "boolean") return raw === "1" || /^(true|sim)$/i.test(raw) ? "Sim" : "Não";
  return raw;
}

/**
 * `labels` vem do "describe" da EOX (nome interno → rótulo); sem ele valem os nomes do perfil real (EOX_FIELDS).
 * Nunca inventa: o que a EOX não tem fica nulo. `opts` só diz quais campos extras também guardam telefone/e-mail.
 */
export function mapAccount(row: EoxRow, labels: Map<string, string>, contacts: EoxRow[] = [], phoneRows: { value: string; type: string | null }[] = [], opts: Pick<ConsultOptions, "extraPhoneFields" | "extraEmailFields"> = CONSULT_DEFAULT): EoxFound {
  const phones: string[] = [], emails: string[] = [], phoneKinds: Record<string, string> = {};
  const info: Record<string, string> = {};
  const addPhones = (raw: unknown, kind: string | null) => { for (const d of phonesIn(raw)) { if (!phones.includes(d)) phones.push(d); if (kind && !phoneKinds[d]) phoneKinds[d] = kind; } };
  const extraP = opts.extraPhoneFields.split(",").filter(Boolean), extraE = opts.extraEmailFields.split(",").filter(Boolean);
  for (const [k, v] of Object.entries(row)) {
    const raw = clean(v);
    if (!raw) continue;
    const [fLabel, fType] = EOX_FIELDS[k] ?? [labels.get(k) ?? k, "string"];
    if (!INFO_SKIP.has(k) && raw.length <= 300 && !/^\d+x\d+$/.test(raw)) { const shown = showValue(fType, raw); if (shown) info[labels.get(k) ?? fLabel] = shown; }
    if (k in PHONE_FIELDS) addPhones(raw, PHONE_FIELDS[k]);
    else if (extraP.includes(k)) addPhones(raw, null);
    if (EMAIL_FIELDS.includes(k) || extraE.includes(k)) emails.push(...emailsIn(raw));
  }
  for (const pr of phoneRows) addPhones(pr.value, pr.type ? PHONE_KIND[pr.type] ?? pr.type : null);

  const people: EoxPerson[] = [];
  for (const c of contacts) {
    const name = [clean(c.firstname), clean(c.lastname)].filter(Boolean).join(" ") || clean(c.name);
    if (!name) continue;
    const cp = [...phonesIn(c.mobile), ...phonesIn(c.phone), ...phonesIn(c.homephone), ...phonesIn(c.otherphone)];
    const ce = [...emailsIn(c.email), ...emailsIn(c.secondaryemail)];
    people.push({ name: name.slice(0, 120), title: clean(c.title) || clean(c.department) || null, phones: [...new Set(cp)], emails: [...new Set(ce)] });
  }

  const street = clean(row.bill_street), num = clean(row.bill_numero), comp = clean(row.bill_complemento);
  const address = [street, num && num !== "0" && !street.includes(num) ? num : "", comp].filter(Boolean).join(", ");
  const uf = clean(row.bill_state).toUpperCase();
  const zip = clean(row.bill_code).replace(/\D/g, "");
  const code = clean(row.id_erp_original).replace(/\D/g, "");
  return {
    site: url(clean(row.website)), facebook: url(clean(row.facebook)), linkedin: url(clean(row.linkedin)),
    address: address || null, neighborhood: clean(row.bill_bairro) || null,
    zip: zip.length === 8 ? zip.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
    city: clean(row.bill_city) || null, uf: /^[A-Z]{2}$/.test(uf) ? uf : null,
    stateReg: clean(row.inscricao_estadual) || null,
    contactName: people[0]?.name ?? null,
    phones, emails: [...new Set(emails)], people: people.slice(0, 15), phoneKinds,
    code: code && code !== "0" ? code : null,
    info,
  };
}
