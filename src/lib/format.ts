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
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s` : `${m}m ${String(sec).padStart(2, "0")}s`;
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

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Tempo desde a abertura da empresa: "1 ano e 3 meses", "2 anos", "10 meses", "menos de 1 mês". Só meses cheios contam. */
export function fmtAge(openedIso: string | null | undefined, now: Date = new Date()): string | null {
  const m = openedIso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  let months = (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - mo);
  if (now.getUTCDate() < d) months -= 1;
  if (months < 0) return null;
  if (months < 1) return "menos de 1 mês";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return plural(rest, "mês", "meses");
  if (rest === 0) return plural(years, "ano", "anos");
  return `${plural(years, "ano", "anos")} e ${plural(rest, "mês", "meses")}`;
}

/** 4789099 → "4789-0/99" */
export function fmtCnae(code: string | number | null | undefined): string | null {
  const d = String(code ?? "").replace(/\D/g, "");
  return d.length === 7 ? `${d.slice(0, 4)}-${d[4]}/${d.slice(5)}` : d || null;
}

