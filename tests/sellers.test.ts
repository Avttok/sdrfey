import { describe, expect, it } from "vitest";
import { hasRole, isSellerOnly } from "@/config/roles";
import { parseMoneyToCents } from "@/config/deals";
import { resolvePermissions } from "@/modules/permissions/resolve";
import { dealAlerts } from "@/modules/deals/queries";

const H = 3600_000;
const base = { stage: "novo" as const, sellerId: 5, createdAt: "", claimedAt: null, quoteSentAt: null, lastContactAt: null, nextActionAt: null, nextActionNote: null };

describe("cargo vendedor", () => {
  it("vendedor não herda poderes de SDR nem de gestão", () => {
    expect(hasRole(["seller"], "user")).toBe(false);
    expect(hasRole(["seller"], "manager")).toBe(false);
    expect(hasRole(["manager"], "seller")).toBe(true);
    expect(hasRole(["user"], "seller")).toBe(false);
    expect(isSellerOnly(["seller"])).toBe(true);
    expect(isSellerOnly(["seller", "manager"])).toBe(false);
  });
  it("vendedor só vê Dashboard, Leads, Histórico, Metas e Negociações", () => {
    const p = resolvePermissions(["seller"]);
    const tabs = Object.entries(p).filter(([k, v]) => k.startsWith("tab.") && v).map(([k]) => k).sort();
    expect(tabs).toEqual(["tab.historico", "tab.leads", "tab.metas", "tab.negociacoes", "tab.painel"]);
    expect(p["tab.comecar"]).toBe(false);
    expect(p["tab.visitas"]).toBe(false);
    expect(p["deals.team"]).toBe(false);
  });
});

describe("valores em reais", () => {
  it("entende formatos brasileiros", () => {
    expect(parseMoneyToCents("12.500,00")).toBe(1250000);
    expect(parseMoneyToCents("R$ 1.234,56")).toBe(123456);
    expect(parseMoneyToCents("1500")).toBe(150000);
    expect(parseMoneyToCents("99,9")).toBe(9990);
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("")).toBeNull();
  });
});

describe("avisos das negociações", () => {
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * H).toISOString();
  it("sem vendedor vira aviso do grupo, vermelho após 1 h", () => {
    expect(dealAlerts({ ...base, sellerId: null, createdAt: ago(0.2) }, now)[0]).toMatchObject({ kind: "pool", tone: "info" });
    expect(dealAlerts({ ...base, sellerId: null, createdAt: ago(3) }, now)[0]).toMatchObject({ kind: "pool", tone: "danger" });
  });
  it("novo sem contato há 2 h manda ligar agora", () => {
    expect(dealAlerts({ ...base, createdAt: ago(3), claimedAt: ago(3) }, now)[0]?.kind).toBe("novo");
    expect(dealAlerts({ ...base, createdAt: ago(3), claimedAt: ago(0.5) }, now)).toEqual([]);
  });
  it("cotação sem resposta há 2 dias manda cobrar; retorno vencido tem prioridade", () => {
    const q = { ...base, stage: "cotacao" as const, createdAt: ago(100), quoteSentAt: ago(50), lastContactAt: ago(50) };
    expect(dealAlerts(q, now)[0]?.kind).toBe("cobrar");
    expect(dealAlerts({ ...q, nextActionAt: ago(1) }, now).map((a) => a.kind)).toEqual(["retorno"]);
    expect(dealAlerts({ ...q, quoteSentAt: ago(10), lastContactAt: ago(10) }, now)).toEqual([]);
  });
  it("em contato parado há 3 dias avisa; encerrada não avisa", () => {
    expect(dealAlerts({ ...base, stage: "contato", createdAt: ago(200), lastContactAt: ago(80) }, now)[0]?.kind).toBe("parado");
    expect(dealAlerts({ ...base, stage: "ganho", createdAt: ago(200) }, now)).toEqual([]);
  });
});
