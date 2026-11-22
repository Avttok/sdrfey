import { describe, expect, it } from "vitest";
import { estimateFreight } from "@/config/carriers";
import { parseCarrierRows } from "@/modules/carriers/parse";

describe("transportadoras", () => {
  it("lê CSV brasileiro com % e vírgula", () => {
    const r = parseCarrierRows(["UF", "Tipo", "Transportadora", "% Capital", "% Interior", "Dias Capital", "Frete mínimo"], [
      { UF: "sp", Tipo: "cif", Transportadora: "Rápido Sul", "% Capital": "3,5%", "% Interior": "5,2", "Dias Capital": "2 dias", "Frete mínimo": "80,00" },
      { UF: "XX", Tipo: "CIF", Transportadora: "Ruim", "% Capital": "", "% Interior": "", "Dias Capital": "", "Frete mínimo": "" },
      { UF: "BA", Tipo: "Redespacho", Transportadora: "Bahia", "% Capital": "5", "% Interior": "8", "Dias Capital": "", "Frete mínimo": "" },
    ]);
    expect(r.drafts).toHaveLength(2);
    expect(r.drafts[0]).toMatchObject({ uf: "SP", mode: "CIF", capitalPct: 3.5, interiorPct: 5.2, capitalDays: 2, minCents: 8000 });
    expect(r.drafts[1].mode).toBe("RED");
    expect(r.warnings.join()).toMatch(/UF "XX"/);
  });
  it("pede as colunas que faltam", () => {
    expect(parseCarrierRows(["UF"], []).missing).toEqual(["Tipo (CIF/FOB/RED)", "Transportadora"]);
  });
  it("estima frete respeitando o mínimo", () => {
    const c = { capitalPct: 3, interiorPct: 5, capitalDays: 2, interiorDays: 4, minCents: 8000 };
    expect(estimateFreight(c, "interior", 100000)).toEqual({ cents: 5000 < 8000 ? 8000 : 5000, days: 4 });
    expect(estimateFreight(c, "capital", 1_000_000)).toEqual({ cents: 30000, days: 2 });
    expect(estimateFreight({ ...c, capitalPct: null }, "capital", 1000)).toBeNull();
  });
});
