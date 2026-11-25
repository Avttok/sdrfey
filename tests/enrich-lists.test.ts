import { describe, expect, it } from "vitest";
import { ENRICH_GROUPS, ENRICH_LISTS, listMeta, normList } from "@/config/enrich-lists";
import { enrichStats } from "@/modules/enrich/batch";

describe("filas da consulta de CNPJ", () => {
  it("chaves únicas, grupos válidos, ícone e cor", () => {
    expect(new Set(ENRICH_LISTS.map((l) => l.key)).size).toBe(ENRICH_LISTS.length);
    for (const l of ENRICH_LISTS) { expect(ENRICH_GROUPS).toContain(l.group); expect(l.hex).toMatch(/^#[0-9a-f]{6}$/i); expect(l.icon).toBeTruthy(); }
    expect(ENRICH_LISTS.length).toBeGreaterThanOrEqual(20);
  });
  it("aceita fila por estado e rejeita o resto", () => {
    expect(normList("uf:SP")).toBe("uf:SP");
    expect(normList("uf:sp")).toBe("new");
    expect(normList("x; drop table leads")).toBe("new");
    expect(listMeta("uf:RJ")?.label).toContain("RJ");
  });
  it("todas as filas têm SQL válido e contagem", async () => {
    const st = await enrichStats();
    for (const l of ENRICH_LISTS) expect(typeof st.lists[l.key]).toBe("number");
    expect(st.ufs).toBeTypeOf("object");
  });
});
