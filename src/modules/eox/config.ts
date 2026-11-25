/** Integração com a API da EOX (base Vtiger): usada só no servidor. A chave de acesso nunca vai para o navegador. */
export type EoxConfig = {
  on: boolean;
  /** Endereço da EOX, ex.: https://fey.vocallcontact.com.br */
  baseUrl: string;
  username: string;
  accessKey: string;
  /** Módulo dos clientes na EOX (padrão Accounts). */
  module: string;
  /** Nome interno do campo do CNPJ no cadastro (ex.: cf_850). */
  cnpjField: string;
  /** Campo do "Código do cliente" (ex.: 117805), se houver: usado quando o CNPJ não bate. */
  codeField: string;
};
export const EOX_KEY = "eox";
export const EOX_DEFAULT: EoxConfig = { on: false, baseUrl: "", username: "", accessKey: "", module: "Accounts", cnpjField: "cnpj", codeField: "id_erp_original" };

export function parseEox(v: unknown): EoxConfig {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof EoxConfig, unknown>>;
  const str = (x: unknown, d: string, max = 200) => (typeof x === "string" ? x.trim().slice(0, max) : d);
  let baseUrl = str(o.baseUrl, "").replace(/\/+$/, "").replace(/\/(index|webservice)\.php.*$/i, "");
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;
  const mod = str(o.module, EOX_DEFAULT.module, 40);
  return {
    on: o.on === true,
    baseUrl,
    username: str(o.username, "", 80),
    accessKey: str(o.accessKey, "", 80),
    module: /^[A-Za-z]{2,40}$/.test(mod) ? mod : EOX_DEFAULT.module,
    cnpjField: str(o.cnpjField, EOX_DEFAULT.cnpjField, 60).replace(/[^A-Za-z0-9_]/g, ""),
    codeField: str(o.codeField, EOX_DEFAULT.codeField, 60).replace(/[^A-Za-z0-9_]/g, ""),
  };
}

export const eoxReady = (c: EoxConfig) => c.on && !!c.baseUrl && !!c.username && !!c.accessKey && !!c.cnpjField;
