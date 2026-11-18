/** Ritmo e projeção das metas, a partir do comportamento da própria pessoa. Funções puras (testáveis). */

export type DayRow = { k: string; day: string; n: number; first: string | null };

export type SdrPace = {
  k: string; n: number; qty: number; done: boolean; remaining: number;
  /** itens por hora de trabalho hoje (desde a primeira atividade) */
  perHour: number | null;
  /** previsão de quando bate a meta, mantendo o ritmo de hoje */
  etaAt: Date | null;
  /** média dos dias anteriores com atividade (até 7) e melhor dia dos últimos 14 */
  avg: number | null; best: number; daysHit: number; daysWorked: number;
  /** projeção do dia pela média: quanto falta em relação à média típica */
  vsAvg: number | null;
};

const spDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** Ritmo do dia de uma meta diária: média histórica, dias em que bateu e quando bate hoje no ritmo atual. */
export function sdrPace(rows: DayRow[], k: string, qty: number, now = new Date()): SdrPace {
  const today = spDay(now);
  const mine = rows.filter((r) => r.k === k);
  const n = mine.find((r) => r.day === today)?.n ?? 0;
  const past = mine.filter((r) => r.day < today && r.n > 0).sort((a, b) => (a.day < b.day ? 1 : -1));
  const last7 = past.slice(0, 7);
  const avg = last7.length ? last7.reduce((a, r) => a + r.n, 0) / last7.length : null;
  const first = mine.find((r) => r.day === today)?.first;
  const hours = first ? Math.max(0.25, (now.getTime() - new Date(first).getTime()) / 3_600_000) : 0;
  const perHour = n > 0 && hours > 0 ? n / hours : null;
  const remaining = Math.max(0, qty - n);
  const etaAt = remaining > 0 && perHour ? new Date(now.getTime() + (remaining / perHour) * 3_600_000) : null;
  return {
    k, n, qty, done: qty > 0 && n >= qty, remaining, perHour, etaAt, avg,
    best: Math.max(0, ...past.map((r) => r.n), n), daysHit: past.filter((r) => qty > 0 && r.n >= qty).length, daysWorked: past.length,
    vsAvg: avg == null ? null : n - avg,
  };
}

/** Dias úteis (seg–sex) de `from` até `to` (inclusive), datas "AAAA-MM-DD". */
export function workdays(from: string, to: string): number {
  let c = 0;
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d = new Date(d.getTime() + 86_400_000)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) c++; }
  return c;
}
const addWork = (from: string, n: number): string => {
  let d = new Date(`${from}T12:00:00Z`), left = n;
  while (left > 0) { d = new Date(d.getTime() + 86_400_000); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  return d.toISOString().slice(0, 10);
};

export type MonthCtx = { today: string; first: string; last: string };
export type SellerPace = {
  /** dias úteis já passados (incluindo hoje) e restantes (depois de hoje) */
  elapsed: number; left: number; total: number;
  perDay: number; projected: number; needPerDay: number; etaDate: string | null; onTrack: boolean; hit: boolean;
};

/** Ritmo mensal de uma métrica: média por dia útil, projeção para o fim do mês, quanto precisa por dia e quando bate a meta. */
export function sellerPace(actual: number, target: number, ctx: MonthCtx): SellerPace {
  const total = workdays(ctx.first, ctx.last), elapsed = Math.max(1, workdays(ctx.first, ctx.today));
  const left = Math.max(0, total - elapsed);
  const perDay = actual / elapsed, projected = perDay * total, remaining = Math.max(0, target - actual);
  const hit = target > 0 && actual >= target;
  const needPerDay = remaining === 0 ? 0 : left > 0 ? remaining / left : remaining;
  let etaDate: string | null = null;
  if (!hit && perDay > 0) { const days = Math.ceil(remaining / perDay); const d = addWork(ctx.today, days); if (d <= ctx.last) etaDate = d; }
  return { elapsed, left, total, perDay, projected, needPerDay, etaDate, onTrack: hit || projected >= target, hit };
}
