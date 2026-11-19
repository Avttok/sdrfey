import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, groupsFor } from "@/config/achievements";

describe("conquistas", () => {
  it("chaves únicas e metas positivas", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.key)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((a) => a.goal > 0)).toBe(true);
  });
  it("cada cargo vê os grupos do que faz", () => {
    expect(groupsFor(["user"])).toEqual(["SDR", "Geral"]);
    expect(groupsFor(["seller"])).toEqual(["Vendas", "Geral"]);
    expect(groupsFor(["admin"])).toEqual(["SDR", "Vendas", "Geral"]);
  });
});
