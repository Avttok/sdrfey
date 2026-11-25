/** Opções da Consulta EOX (o Adm liga e desliga cada parte). Sem acesso a banco: a tela também usa. */
export type ConsultOptions = {
  /** telefones do cadastro (Telefone, Outro, Alternativos, WhatsApp) */
  phones: boolean;
  /** lista "Telefones" da EOX (todos os números, com o tipo) */
  phoneList: boolean;
  emails: boolean;
  /** contatos da empresa (nome, cargo, telefone, e-mail) */
  people: boolean;
  /** endereço, CEP, bairro, cidade e UF */
  address: boolean;
  /** site, Facebook e Linkedin */
  social: boolean;
  /** Inscrição Estadual */
  fiscal: boolean;
  /** guarda o retrato completo da EOX no lead (tipo, vendedor, financeiro…) */
  info: boolean;
  /** leads por passo do modo contínuo */
  batch: number;
  /** consultas ao mesmo tempo */
  workers: number;
  /** horas até um lead que falhou voltar para a fila */
  retryHours: number;
  /** campos extras (nome interno na EOX, separados por vírgula) que também guardam telefones / e-mails */
  extraPhoneFields: string;
  extraEmailFields: string;
};
export const CONSULT_KEY = "eox_consult";
export const CONSULT_DEFAULT: ConsultOptions = { phones: true, phoneList: true, emails: true, people: true, address: true, social: true, fiscal: true, info: true, batch: 50, workers: 5, retryHours: 6, extraPhoneFields: "", extraEmailFields: "" };

export function parseConsult(v: unknown): ConsultOptions {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof ConsultOptions, unknown>>;
  const b = (x: unknown, d: boolean) => (typeof x === "boolean" ? x : d);
  const n = (x: unknown, d: number, min: number, max: number) => { const k = Number(x); return Number.isFinite(k) ? Math.min(max, Math.max(min, Math.round(k))) : d; };
  const names = (x: unknown) => (typeof x === "string" ? x.split(/[\s,;]+/).map((s) => s.replace(/[^A-Za-z0-9_]/g, "")).filter(Boolean).slice(0, 20).join(",") : "");
  const d = CONSULT_DEFAULT;
  return {
    phones: b(o.phones, d.phones), phoneList: b(o.phoneList, d.phoneList), emails: b(o.emails, d.emails), people: b(o.people, d.people), address: b(o.address, d.address),
    social: b(o.social, d.social), fiscal: b(o.fiscal, d.fiscal), info: b(o.info, d.info),
    batch: n(o.batch, d.batch, 10, 100), workers: n(o.workers, d.workers, 1, 10), retryHours: n(o.retryHours, d.retryHours, 1, 72),
    extraPhoneFields: names(o.extraPhoneFields), extraEmailFields: names(o.extraEmailFields),
  };
}
