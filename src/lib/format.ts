/** Datas sempre DD/MM/AAAA e horário de Brasília (GMT-3). No banco tudo fica em UTC. */
export const TZ = "America/Sao_Paulo";

const date = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateTimeSec = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const asDate = (d: Date | string | number | null | undefined) => (d == null ? null : new Date(d));

export const fmtDate = (d: Date | string | number | null | undefined) => {
  const x = asDate(d);
  return x ? date.format(x) : "—";
};
export const fmtDateTime = (d: Date | string | number | null | undefined) => {
  const x = asDate(d);
  return x ? dateTime.format(x).replace(",", "") : "—";
};
export const fmtDateTimeSec = (d: Date | string | number | null | undefined) => {
  const x = asDate(d);
  return x ? dateTimeSec.format(x).replace(",", "") : "—";
};

/** "2m05s" a partir de segundos. */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** Início do dia (00:00 de Brasília) de uma data "AAAA-MM-DD" vinda de <input type="date">, como Date em UTC. */
export function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00-03:00`);
}
/** Fim do dia (23:59:59.999 de Brasília). */
export function dayEnd(iso: string): Date {
  return new Date(`${iso}T23:59:59.999-03:00`);
}

export const fmtPhone = (digits: string) =>
  digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits.length === 10 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}` : digits;

export const fmtCnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
