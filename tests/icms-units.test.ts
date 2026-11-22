import { describe, expect, it } from "vitest";
import { cleanIcmsRule, DEFAULT_ICMS_RULE, parsePctInput, pickIcmsPct } from "@/modules/quotes/icms";
import { fmtQty, unitsOf } from "@/modules/quotes/units";

describe("cento", () => {
  it("0,2 cento são 20 unidades", () => {
    expect(unitsOf(0.2, "CEN")).toBe(20);
    expect(unitsOf(0.2, "CENTO")).toBe(20);
    expect(unitsOf(5, "UN")).toBe(5);
    expect(fmtQty(0.2, "CEN")).toBe("20 un (0,2 cento)");
  });
});
describe("ICMS", () => {
  it("por cotação > por UF > padrão; modo PDF devolve null", () => {
    const rate = { ...DEFAULT_ICMS_RULE, mode: "rate" as const };
    expect(pickIcmsPct(rate, "BA")).toBe(7);
    expect(pickIcmsPct(rate, "SP")).toBe(12);
    expect(pickIcmsPct(rate, "XX")).toBe(12);
    expect(pickIcmsPct(rate, "BA", 4)).toBe(4);
    expect(pickIcmsPct(DEFAULT_ICMS_RULE, "BA")).toBeNull();
    expect(pickIcmsPct(DEFAULT_ICMS_RULE, "BA", 7)).toBe(7);
  });
  it("limpa regra e entrada", () => {
    expect(cleanIcmsRule({ mode: "rate", defaultPct: 99, byUf: { SP: 18, zz: 5, RJ: "x" } })).toMatchObject({ mode: "rate", defaultPct: 12 });
    expect(cleanIcmsRule({ byUf: { SP: 18 } }).byUf.SP).toBe(18);
    expect(parsePctInput("7,5")).toBe(7.5);
    expect(parsePctInput("")).toBeNull();
    expect(parsePctInput("abc")).toBeNull();
  });
});

import { parseItems } from "@/modules/quotes/parse";
describe("leitura de item em cento", () => {
  it("lê 0,2 CENTO e 0,20 CEN", () => {
    const a = parseItems(["10 72830 0,2 1,00 CENTO MOLA GRAMPO 12,00 5,00 600,00 120,00"]);
    expect(a[0]).toMatchObject({ productCode: "72830", qty: 0.2, unit: "CENTO", totalCents: 12000 });
    const b = parseItems(["20 72831 0,20 1,00 CEN PINO CENTRAL 10,00 0,00 500,00 100,00"]);
    expect(b[0]).toMatchObject({ qty: 0.2, unit: "CEN" });
  });
});
