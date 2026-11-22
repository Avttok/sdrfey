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
  it("lixo vira filtros vazios", () => {
    expect(cleanListFilters(null)).toEqual({ ...EMPTY_FILTERS, phone: false });
    expect(describeFilters(cleanListFilters(undefined))).toEqual([]);
  });
});
