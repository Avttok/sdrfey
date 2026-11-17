import { describe, expect, it } from "vitest";
import { normalizeItem, normTerm, totalsOf } from "@/modules/quotes/db";

const item = { seq: 10, productCode: "A1", clientRef: null, description: "CAIXA X", kind: "CAIXA", qty: 10, packQty: null, unit: "CEN", icmsCents: 100, ipiCents: 200, unitCents: 5000, totalCents: 0 };

describe("cotações", () => {
  it("total do item = quantidade × preço unitário", () => expect(normalizeItem(item).totalCents).toBe(50000));
  it("impostos acompanham a quantidade editada", () => { const r = normalizeItem({ ...item, qty: 20 }, 10); expect(r.ipiCents).toBe(400); expect(r.icmsCents).toBe(200); expect(r.totalCents).toBe(100000); });
  it("totais: sem impostos = total − IPI − ICMS", () => expect(totalsOf([normalizeItem(item)], 1000)).toEqual({ productsCents: 50000, ipiCents: 200, icmsCents: 100, totalCents: 51200, netCents: 50900 }));
  it("normaliza condição de pagamento", () => expect(normTerm("  28  ddl ")).toBe("28 DDL"));
});

import { parseItems } from "@/modules/quotes/parse";
describe("leitura do PDF", () => {
  it("não perde o último item por causa das linhas de assinatura", () => {
    const lines = ["SEQ CÓDIGO", "ICMS IPI UNITÁRIO TOTAL", "10 789529 1,00 1,00 CEN PARAFUSO AC RODA CON", "9/16X1.1/2 UNF ZTI 20,65 11,18 172,05 172,05", "20 797272 0,50 0,50 CEN PARAFUSO AC RODA RP", "5/8X2.3/8 UNF G5 ZTI 13,23 7,17 220,56 110,28", "____/____/________", "DATA:", "NOME:", "ASSINATURA:", "PRAZO DE ENTREGA: A COMBINAR"];
    const items = parseItems(lines);
    expect(items.map((i) => i.seq)).toEqual([10, 20]);
    expect(items[1].totalCents).toBe(11028);
  });
});
