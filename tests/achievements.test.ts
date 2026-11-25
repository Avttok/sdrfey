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

import { AVATARS } from "@/config/avatars";
import { BANNERS } from "@/config/banners";
import { ACHIEVEMENT_BY_KEY } from "@/config/achievements";
import { achievementStats } from "@/modules/achievements/stats";
describe("conquistas novas e cosméticos", () => {
  it("todo cosmético liberado por conquista aponta para uma conquista que existe", () => {
    for (const a of AVATARS) if (a.unlock) expect(ACHIEVEMENT_BY_KEY.has(a.unlock), a.key).toBe(true);
    for (const b of BANNERS) if (b.unlock) expect(ACHIEVEMENT_BY_KEY.has(b.unlock), b.key).toBe(true);
    expect(new Set(AVATARS.map((a) => a.key)).size).toBe(AVATARS.length);
    expect(new Set(BANNERS.map((b) => b.key)).size).toBe(BANNERS.length);
  });
  it("toda estatística usada existe na consulta", async () => {
    const st = await achievementStats(-1);
    for (const a of ACHIEVEMENTS) if (a.stat !== "egg") expect(a.stat in st, a.key).toBe(true);
  });
});
