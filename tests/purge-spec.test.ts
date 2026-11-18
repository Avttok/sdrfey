import { describe, expect, it } from "vitest";
import { PURGE_CATEGORIES, PURGE_SQL, USER_PURGE } from "@/modules/admin/purge-spec";

describe("categorias de exclusão", () => {
  it("toda categoria tem tabela e as opções batem com o SQL", () => {
    for (const c of PURGE_CATEGORIES) {
      const s = PURGE_SQL[c.key];
      expect(s?.table, c.key).toBeTruthy();
      expect(!!s.test, `${c.key} teste`).toBe(c.test);
      expect(!!s.time, `${c.key} data`).toBe(c.time);
    }
  });
  it("não há chaves repetidas", () => {
    const keys = PURGE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const u = USER_PURGE.map((c) => c.key);
    expect(new Set(u).size).toBe(u.length);
  });
});
