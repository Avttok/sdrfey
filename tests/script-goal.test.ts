import { describe, expect, it } from "vitest";
import { goalFor } from "@/modules/scripts/goal";

describe("categoria do script conforme a situação", () => {
  it("lead novo do SDR recebe prospecção", () => expect(goalFor("prospect", null, "sdr")).toBe("sdr"));
  it("lead inativo recebe reativação", () => { expect(goalFor("inativo", null, "vendas")).toBe("reativar"); expect(goalFor("inativo", null, "sdr")).toBe("reativar"); });
  it("com cotação enviada recebe retorno", () => { expect(goalFor("inativo", "cotacao", "vendas")).toBe("retorno"); expect(goalFor("prospect", "negociacao", "sdr")).toBe("retorno"); });
  it("negociação aberta sem cotação recebe venda", () => { expect(goalFor("prospect", "novo", "vendas")).toBe("vendas"); expect(goalFor("inativo", "contato", "vendas")).toBe("vendas"); });
  it("sem dados: segue a área", () => { expect(goalFor(null, null, "vendas")).toBe("vendas"); expect(goalFor(null, null, "sdr")).toBe("sdr"); });
});
