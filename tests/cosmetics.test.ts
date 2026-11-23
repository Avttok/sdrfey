import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_BY_KEY, RARITIES, rarityOf } from "@/config/achievements";
import { AVATARS } from "@/config/avatars";
import { BANNERS } from "@/config/banners";

describe("cosméticos de conquistas", () => {
  it("todo cosmético travado aponta para uma conquista que existe", () => {
    for (const c of [...AVATARS, ...BANNERS]) if (c.unlock) expect(ACHIEVEMENT_BY_KEY.has(c.unlock), `${c.key} → ${c.unlock}`).toBe(true);
  });
  it("as chaves não se repetem", () => {
    expect(new Set(AVATARS.map((a) => a.key)).size).toBe(AVATARS.length);
    expect(new Set(BANNERS.map((b) => b.key)).size).toBe(BANNERS.length);
  });
  it("as quatro raridades existem e têm cosmético", () => {
    const got = new Set([...AVATARS, ...BANNERS].filter((c) => c.unlock).map((c) => rarityOf(c.unlock!)));
    for (const r of RARITIES) expect(got.has(r.key), r.key).toBe(true);
  });
});
