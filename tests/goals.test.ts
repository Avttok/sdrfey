import { describe, expect, it } from "vitest";
import { SETTING_DEFAULTS } from "@/modules/settings/get";
import { effectiveGoals } from "@/modules/settings/goals";
import { attainment, resolveSellerGoals, SELLER_METRICS } from "@/config/seller-goals";

const base = { dailyGoal: null, dailyGoalScheduled: null, goalAttendedOn: null, goalScheduledOn: null, goalsExtra: {} };

describe("metas do SDR", () => {
  it("segue a global e as novas metas começam desligadas", () => {
    const g = effectiveGoals(base, SETTING_DEFAULTS);
    expect(g.attended).toEqual({ on: true, qty: 35 });
    expect(g.calls.on).toBe(false);
    expect(g.converted.on).toBe(false);
  });
  it("ajuste próprio liga e muda a quantidade", () => {
    const g = effectiveGoals({ ...base, goalsExtra: { calls_on: 1, calls: 50 } }, SETTING_DEFAULTS);
    expect(g.calls).toEqual({ on: true, qty: 50 });
  });
  it("desativar todas vence tudo", () => {
    const g = effectiveGoals({ ...base, goalAttendedOn: true, goalsExtra: { off_all: 1, calls_on: 1 } }, SETTING_DEFAULTS);
    expect(Object.values(g).every((x) => !x.on)).toBe(true);
  });
});

describe("metas de vendas", () => {
  const actual = { calls: 600, engaged: 0, quotes: 0, sold: 0, reactivated: 0 };
  it("métrica desligada sai da meta geral e os pesos se reescalam", () => {
    const { targets, weights, enabled } = resolveSellerGoals({ off_engaged: 1, off_quotes: 1, off_sold: 1, off_reactivated: 1 });
    expect(enabled.calls).toBe(true);
    expect(attainment(actual, targets, weights, enabled).overall).toBe(100);
  });
  it("ajuste próprio liga de novo e 'desligar todas' apaga tudo", () => {
    expect(resolveSellerGoals({ off_calls: 1 }, { off_calls: 0 }).enabled.calls).toBe(true);
    const r = resolveSellerGoals({}, { off_all: 1 });
    expect(SELLER_METRICS.every((m) => !r.enabled[m.key])).toBe(true);
    expect(attainment(actual, r.targets, r.weights, r.enabled).overall).toBe(0);
  });
});

import { sdrPace, sellerPace, workdays } from "@/config/pace";
describe("ritmo", () => {
  it("projeta a hora em que o SDR bate a meta", () => {
    const now = new Date("2026-11-17T18:00:00Z"); // 15:00 em Brasília
    const rows = [{ k: "attended", day: "2026-11-17", n: 10, first: "2026-11-17T12:00:00Z" }, { k: "attended", day: "2026-11-16", n: 30, first: null }, { k: "attended", day: "2026-11-13", n: 40, first: null }];
    const p = sdrPace(rows, "attended", 20, now);
    expect(p.perHour).toBeCloseTo(10 / 6);
    expect(p.etaAt!.getTime()).toBeCloseTo(now.getTime() + 6 * 3_600_000, -3);
    expect(p.avg).toBe(35); expect(p.daysHit).toBe(2); expect(p.best).toBe(40);
  });
  it("sem atividade hoje não inventa previsão", () => expect(sdrPace([], "calls", 10).etaAt).toBeNull());
  it("conta dias úteis e projeta o mês", () => {
    expect(workdays("2026-11-01", "2026-11-30")).toBe(21);
    const p = sellerPace(100, 400, { today: "2026-11-17", first: "2026-11-01", last: "2026-11-30" });
    expect(p.elapsed).toBe(12); expect(p.left).toBe(9);
    expect(p.projected).toBeCloseTo((100 / 12) * 21);
    expect(p.onTrack).toBe(false); expect(p.needPerDay).toBeCloseTo(300 / 9);
  });
});

import { readQuick, signQuick } from "@/modules/auth/token";
describe("login de 1 clique", () => {
  it("assina e lê o cookie; lixo é recusado", async () => {
    const t = await signQuick({ uid: 3, v: 2, name: "Ruan", rem: true });
    expect(await readQuick(t)).toEqual({ uid: 3, v: 2, name: "Ruan", rem: true });
    expect(await readQuick("lixo")).toBeNull();
  });
});
