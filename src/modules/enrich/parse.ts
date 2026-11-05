import { fmtCnae } from "@/lib/format";

/** Leitura das respostas da BrasilAPI e da ReceitaWS num formato único. Sem rede, fácil de testar. */

export type CnpjInfo = {
  legalName: string | null;
  tradeName: string | null;
  /** Situação cadastral em maiúsculas, ex.: ATIVA, BAIXADA, INAPTA, SUSPENSA. */
  status: string | null;
  city: string | null;
  uf: string | null;
  phones: string[];
  emails: string[];
  porte: string | null;
  capital: number | null;
  openedAt: string | null; // ISO yyyy-mm-dd
  activity: string | null;
  /** Código CNAE já formatado (4789-0/99). */
  cnae: string | null;
  address: { street: string | null; number: string | null; complement: string | null; district: string | null; cep: string | null };
  partners: { name: string; role: string | null }[];
};

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
};

/** Aceita "(11) 1234-5678 / (11) 91234-5678", "1112345678" e variações. */
export function parsePhones(raw: unknown): string[] {
  return String(raw ?? "")
    .split(/[\/;,]| ou /i)
    .map(digits)
    .map((d) => (d.length === 12 || d.length === 13 ? d.replace(/^55/, "") : d))
    .map((d) => (d.length === 10 && /^[1-9]{2}[6-9]/.test(d) ? d.slice(0, 2) + "9" + d.slice(2) : d)) // celular antigo de 8 dígitos
    .filter((d) => d.length === 10 || d.length === 11);
}

export function parseBrasilApi(j: any): CnpjInfo | null {
  if (!j || typeof j !== "object" || !j.cnpj) return null;
  return {
    legalName: str(j.razao_social),
    tradeName: str(j.nome_fantasia),
    status: str(j.descricao_situacao_cadastral)?.toUpperCase() ?? null,
    city: str(j.municipio),
    uf: str(j.uf)?.toUpperCase() ?? null,
    phones: [...parsePhones(j.ddd_telefone_1), ...parsePhones(j.ddd_telefone_2)],
    emails: str(j.email) ? [str(j.email)!.toLowerCase()] : [],
    porte: str(j.porte) ?? str(j.descricao_porte),
    capital: typeof j.capital_social === "number" ? j.capital_social : null,
    openedAt: str(j.data_inicio_atividade),
    activity: str(j.cnae_fiscal_descricao),
    cnae: fmtCnae(j.cnae_fiscal),
    address: {
      street: [str(j.descricao_tipo_de_logradouro), str(j.logradouro)].filter(Boolean).join(" ") || null,
      number: str(j.numero), complement: str(j.complemento), district: str(j.bairro), cep: str(j.cep)?.replace(/\D/g, "") || null,
    },
    partners: Array.isArray(j.qsa)
      ? j.qsa.filter((p: any) => str(p?.nome_socio)).map((p: any) => ({ name: str(p.nome_socio)!, role: str(p.qualificacao_socio) }))
      : [],
  };
}

export function parseReceitaWs(j: any): CnpjInfo | null {
  if (!j || typeof j !== "object" || j.status === "ERROR" || !j.cnpj) return null;
  const open = str(j.abertura)?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const cap = Number(String(j.capital_social ?? "").replace(",", "."));
  return {
    legalName: str(j.nome),
    tradeName: str(j.fantasia),
    status: str(j.situacao)?.toUpperCase() ?? null,
    city: str(j.municipio),
    uf: str(j.uf)?.toUpperCase() ?? null,
    phones: parsePhones(j.telefone),
    emails: str(j.email) ? [str(j.email)!.toLowerCase()] : [],
    porte: str(j.porte),
    capital: Number.isFinite(cap) && String(j.capital_social ?? "") !== "" ? cap : null,
    openedAt: open ? `${open[3]}-${open[2]}-${open[1]}` : null,
    activity: str(j.atividade_principal?.[0]?.text),
    cnae: fmtCnae(j.atividade_principal?.[0]?.code),
    address: { street: str(j.logradouro), number: str(j.numero), complement: str(j.complemento), district: str(j.bairro), cep: str(j.cep)?.replace(/\D/g, "") || null },
    partners: Array.isArray(j.qsa) ? j.qsa.filter((p: any) => str(p?.nome)).map((p: any) => ({ name: str(p.nome)!, role: str(p.qual) })) : [],
  };
}

/** Junta as duas fontes: o primeiro valor preenchido ganha, e telefones/e-mails de ambas são somados. */
export function mergeInfo(a: CnpjInfo | null, b: CnpjInfo | null): CnpjInfo | null {
  if (!a && !b) return null;
  const x = a ?? b!;
  const y = a && b ? b : null;
  const pick = <K extends keyof CnpjInfo>(k: K) => (x[k] ?? y?.[k] ?? null) as CnpjInfo[K];
  return {
    legalName: pick("legalName"),
    tradeName: pick("tradeName"),
    status: pick("status"),
    city: pick("city"),
    uf: pick("uf"),
    phones: [...new Set([...x.phones, ...(y?.phones ?? [])])],
    emails: [...new Set([...x.emails, ...(y?.emails ?? [])])],
    porte: pick("porte"),
    capital: pick("capital"),
    openedAt: pick("openedAt"),
    activity: pick("activity"),
    cnae: pick("cnae"),
    address: {
      street: x.address.street ?? y?.address.street ?? null, number: x.address.number ?? y?.address.number ?? null,
      complement: x.address.complement ?? y?.address.complement ?? null, district: x.address.district ?? y?.address.district ?? null, cep: x.address.cep ?? y?.address.cep ?? null,
    },
    partners: x.partners.length ? x.partners : (y?.partners ?? []),
  };
}

/** Situação cadastral → tag de situação a aplicar (nulo = ATIVA, nada a fazer). */
export function statusToSituation(status: string | null): string | null {
  if (!status || status === "ATIVA") return null;
  if (status === "BAIXADA") return "baixada";
  if (status === "INAPTA") return "inapta";
  if (status === "SUSPENSA") return "suspensa";
  return "auto_descarte"; // NULA e outras
}
