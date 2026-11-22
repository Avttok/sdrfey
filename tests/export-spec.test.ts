import { describe, expect, it } from "vitest";
import { EX_DATASETS, EX_DATASETS_KEYS } from "@/config/export-spec";
import { PERMISSIONS } from "@/config/permissions";

describe("exportação: descrição e SQL andam juntas", async () => {
  const { DEFS } = await import("@/modules/export/sql");
  for (const d of EX_DATASETS) {
    it(`${d.key}: toda coluna tem expressão e todo filtro tem condição`, () => {
      const def = DEFS[d.key];
      for (const c of d.columns) expect(def.expr[c.key], `coluna ${c.key}`).toBeTruthy();
      for (const f of d.filters) expect(def.filter[f.key], `filtro ${f.key}`).toBeTypeOf("function");
      expect(new Set(d.columns.map((c) => c.key)).size).toBe(d.columns.length);
    });
  }
  it("cada base tem permissão export.* e a aba tem tab.exportar", () => {
    for (const k of EX_DATASETS_KEYS) expect(PERMISSIONS.some((p) => p.key === `export.${k}`), k).toBe(true);
    expect(PERMISSIONS.some((p) => p.key === "tab.exportar")).toBe(true);
  });
});
