import { describe, expect, it } from "vitest";
import { classifyProduct, findUnknownTerms } from "@/modules/products/classify";

const terms = [{ code: "NYL", meaning: "Nylon", category: "Material" }, { code: "AC", meaning: "Aço Carbono", category: "Material" }, { code: "RI", meaning: "Rosca Inteira", category: "Rosca" }];
describe("nomenclatura de produtos", () => {
  it("classifica pela sigla inteira", () => {
    expect(classifyProduct("PARAFUSO SEXT RI AC 5/16", terms).map((t) => t.code)).toEqual(["RI", "AC"]);
    expect(classifyProduct("PORCA TRAVANTE NYLON", terms)).toEqual([]);
  });
  it("acha siglas novas repetidas", () => {
    const d = ["PARAFUSO RI ZB 5/16", "PORCA ZB M10", "ARRUELA LISA DE AC", "PINO CENTRAL"];
    expect(findUnknownTerms(d, ["RI", "AC"]).map((u) => u.code)).toEqual(["ZB"]);
  });
});
