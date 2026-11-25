import { describe, expect, it } from "vitest";
import { cleanListFilters, describeFilters, EMPTY_FILTERS } from "@/config/lists";

describe("Lista Flow", () => {
  it("limpa filtros vindos do navegador", () => {
    const f = cleanListFilters({ ufs: ["SP", "XX", 3], city: "  Campinas ", segments: ["posto_molas", "inexistente"], tags: ["porte:me", "x;drop"], phone: true, enriched: "banana" });
    expect(f.ufs).toEqual(["SP"]);
    expect(f.city).toBe("Campinas");
    expect(f.segments).toEqual(["posto_molas"]);
    expect(f.tags).toEqual(["porte:me"]);
    expect(f.enriched).toBe("any");
  });
  it("limita tamanho e valida as opções novas", () => {
    const f = cleanListFilters({ size: 500, color: "#000", icon: "x", age: "old", quiet: 60, order: "newest", mobile: true, active: true });
    expect(f.size).toBe(100);
    expect(cleanListFilters({ size: 3 }).size).toBe(10);
    expect(f.color).toBe(EMPTY_FILTERS.color);
    expect(f.icon).toBe("target");
    expect([f.age, f.quiet, f.order, f.mobile, f.active]).toEqual(["old", 60, "newest", true, true]);
    expect(cleanListFilters({ quiet: 7, age: "zz", order: "zz" })).toMatchObject({ quiet: 0, age: "any", order: "random" });
    expect(describeFilters(f)).toEqual(expect.arrayContaining(["só ATIVAS", "com celular", "sem contato há 60+ dias"]));
  });
  it("lixo vira filtros vazios", () => {
    expect(cleanListFilters(null)).toEqual({ ...EMPTY_FILTERS, phone: false });
    expect(describeFilters(cleanListFilters(undefined))).toEqual([]);
  });
});
