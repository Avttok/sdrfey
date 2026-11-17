import { describe, expect, it } from "vitest";
import { normalizeItem, normTerm, totalsOf } from "@/modules/quotes/db";

const item = { seq: 10, productCode: "A1", clientRef: null, description: "CAIXA X", kind: "CAIXA", qty: 10, packQty: null, unit: "CEN", icmsCents: 100, ipiCents: 200, unitCents: 5000, totalCents: 0 };

describe("cotações", () => {
  it("total do item = quantidade × preço unitário", () => expect(normalizeItem(item).totalCents).toBe(50000));
  it("impostos acompanham a quantidade editada", () => { const r = normalizeItem({ ...item, qty: 20 }, 10); expect(r.ipiCents).toBe(400); expect(r.icmsCents).toBe(200); expect(r.totalCents).toBe(100000); });
  it("totais: produtos, IPI e frete", () => expect(totalsOf([normalizeItem(item)], 1000)).toEqual({ productsCents: 50000, ipiCents: 200, totalCents: 51200 }));
  it("normaliza condição de pagamento", () => expect(normTerm("  28  ddl ")).toBe("28 DDL"));
});
