import { describe, expect, it } from "vitest";
import { activeCount, NO_FILTER, norm, reaisToCents } from "@/components/deals/deal-filters";

describe("filtros de negociações", () => {
  it("converte reais em centavos", () => {
    expect(reaisToCents("1.234,50")).toBe(123450);
    expect(reaisToCents("80")).toBe(8000);
    expect(reaisToCents("")).toBeNull();
    expect(reaisToCents("abc")).toBeNull();
  });
  it("normaliza acentos e caixa para a busca", () => {
    expect(norm("Cotação ÁGUA")).toBe("cotacao agua");
  });
  it("sem filtros, nenhum filtro ativo; com busca e UF, dois", () => {
    expect(activeCount(NO_FILTER)).toBe(0);
    expect(activeCount({ ...NO_FILTER, q: "alfa", uf: "SP" })).toBe(2);
  });
});
