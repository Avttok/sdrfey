/** Ligação pelo VocallAgent (a central da EOX): configuração guardada na tabela de parâmetros (sem banco aqui, o navegador também usa). */
export type VocallConfig = {
  on: boolean;
  /** Endereço do servidor do VocallAgent (o mesmo "ip_vocallagent" da página da EOX). */
  host: string;
  port: number;
  /** wss (seguro) é obrigatório a partir de um site https. */
  secure: boolean;
  dac: string;
  senha: string;
  /** Texto colocado antes do número (ex.: "0" ou "9"). Vazio = só os dígitos com DDD. */
  prefix: string;
};
export const VOCALL_DEFAULT: VocallConfig = { on: false, host: "", port: 8001, secure: true, dac: "SAC", senha: "1234", prefix: "" };
export const VOCALL_KEY = "vocall";

export function parseVocall(v: unknown): VocallConfig {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof VocallConfig, unknown>>;
  const str = (x: unknown, d: string, max = 120) => (typeof x === "string" ? x.trim().slice(0, max) : d);
  const port = Number(o.port);
  return {
    on: o.on === true,
    host: str(o.host, "").replace(/^(wss?|https?):\/\//i, "").replace(/[/:].*$/, ""),
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : VOCALL_DEFAULT.port,
    secure: o.secure !== false,
    dac: str(o.dac, VOCALL_DEFAULT.dac, 30) || VOCALL_DEFAULT.dac,
    senha: str(o.senha, VOCALL_DEFAULT.senha, 60) || VOCALL_DEFAULT.senha,
    prefix: str(o.prefix, "", 6).replace(/[^\d*#+]/g, ""),
  };
}
