import { describe, expect, it } from "vitest";
import { parseQuoteText } from "@/modules/quotes/parse";
import { attainment, resolveSellerGoals, SELLER_METRICS } from "@/config/seller-goals";

const SAMPLE = `METALURGICA FEY LTDA
COTAÇÃO: 20276616
Data da Cotação: 16/11/2026
CNPJ/CPF Cliente: 20.102.553/0001-62
Nome Cliente: MENDEL INDUSTRIA E COMERCIO DE EQUIPAMENTOS
MEDICOS HOSPITALARES
Endereço: R EXPEDICIONARIO
Código do Cliente: 0000122776
Estado: PR
Cidade: SAO JOSE DOS PINHAIS
Condições de Pagamento: CARTAO DE CREDITO 3 PARCELAS
Icoterms(Frete): RED
ICMS IPI UNITÁRIO TOTAL
10 728948 2,00 2,00 CEN PARAFUSO AC SX RI
M10X1,50X30 8.8 ZTI 11,93 6,46 49,72 99,44
90 36234
CLASSE
8
POLIDA
30,00 5,00 CEN PORCA AC SX M12X1,25 CL8
PO 90,32 48,93 25,09 752,70
PRAZO DE ENTREGA: A COMBINAR
VALIDADE DA PROPOSTA: 10 DIAS
Valor Produtos: 3.274,45
Valor IPI: 212,84
Frete Negociado: 0,00
Valor Cotação: 3.487,29`;

describe("parseQuoteText", () => {
  const q = parseQuoteText(SAMPLE);
  it("extrai os campos principais", () => {
    expect(q.quoteNumber).toBe("20276616");
    expect(q.quoteDate).toBe("2026-11-16");
    expect(q.cnpj).toBe("20102553000162");
    expect(q.clientName).toBe("MENDEL INDUSTRIA E COMERCIO DE EQUIPAMENTOS MEDICOS HOSPITALARES");
    expect(q.sapCode).toBe("122776");
    expect(q.uf).toBe("PR");
    expect(q.city).toBe("SAO JOSE DOS PINHAIS");
    expect(q.freight).toBe("RED");
    expect(q.paymentTerms).toBe("CARTAO DE CREDITO 3 PARCELAS");
    expect(q.totalCents).toBe(348729);
    expect(q.productsCents).toBe(327445);
    expect(q.validityDays).toBe(10);
    expect(q.items).toHaveLength(2);
    expect(q.items[0]).toMatchObject({ seq: 10, productCode: "728948", kind: "PARAFUSO", qty: 2, unit: "CEN", unitCents: 4972, totalCents: 9944, description: "PARAFUSO AC SX RI M10X1,50X30 8.8 ZTI" });
    expect(q.items[1]).toMatchObject({ seq: 90, clientRef: "CLASSE 8 POLIDA", kind: "PORCA", qty: 30, packQty: 5, totalCents: 75270 });
  });
  it("texto sem cotação não quebra", () => { expect(parseQuoteText("oi").totalCents).toBeNull(); });
});

describe("metas de vendedor", () => {
  const w = resolveSellerGoals({}).weights;
  it("padrões e pesos somam 100", () => { expect(SELLER_METRICS.reduce((a, m) => a + w[m.key], 0)).toBe(100); });
  it("meta geral limita cada métrica a 100%, % individual não", () => {
    const { targets, weights } = resolveSellerGoals({});
    const r = attainment({ calls: 1200, engaged: 30, quotes: 0, sold: 0, reactivated: 0 }, targets, weights);
    expect(r.each.calls).toBe(200);
    expect(r.overall).toBe(35);
  });
  it("meta própria vence a global", () => { expect(resolveSellerGoals({ calls: 500 }, { calls: 300 }).targets.calls).toBe(300); });
});

import { soldBeforeThisMonth } from "@/modules/deals/portfolio";
describe("carteira mensal", () => {
  const now = new Date("2026-12-01T12:00:00-03:00");
  it("venda de mês anterior sai da carteira no dia 1º", () => {
    expect(soldBeforeThisMonth({ stage: "ganho", closedOn: "2026-11-06", closedAt: null }, now)).toBe(true);
    expect(soldBeforeThisMonth({ stage: "ganho", closedOn: "2026-12-01", closedAt: null }, now)).toBe(false);
  });
  it("só vale para vendas fechadas", () => {
    expect(soldBeforeThisMonth({ stage: "perdido", closedOn: "2026-11-06", closedAt: null }, now)).toBe(false);
    expect(soldBeforeThisMonth({ stage: "ganho", closedOn: null, closedAt: "2026-11-30T23:30:00-03:00" }, now)).toBe(true);
  });
});
