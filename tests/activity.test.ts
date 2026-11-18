import { describe, expect, it } from "vitest";
import { describePath, kindOfText } from "@/config/activity";

describe("describePath", () => {
  it("telas simples", () => {
    expect(describePath("/metas").text).toBe("Conferindo as metas");
    expect(describePath("/admin/apagar").kind).toBe("trash");
    expect(describePath("/admin").text).toBe("No painel Adm");
  });
  it("detalhe pede o nome e usa a empresa", () => {
    expect(describePath("/negociacoes/12").detail).toEqual({ kind: "deal", id: 12 });
    expect(describePath("/negociacoes/12", "ACME").text).toBe("Negociando ACME");
    expect(describePath("/leads/5", "Beta").text).toBe("Vendo o lead Beta");
    expect(describePath("/negociacoes/importar").kind).toBe("import");
  });
  it("ícone vem da frase", () => {
    expect(kindOfText("Ausente · Conferindo as metas")).toBe("away");
    expect(kindOfText("Atendendo X")).toBe("attend");
    expect(kindOfText(null)).toBe("online");
  });
});
