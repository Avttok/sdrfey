import { describe, expect, it } from "vitest";
import { fillScript, spokenCompany } from "@/config/scripts";

describe("fillScript", () => {
  const full = { empresa: "A BUCHA PARAFUSOS LTDA", contato: "CARLOS SILVA", meunome: "Ruan" };
  it("usa o primeiro nome do contato e o nome falado da empresa", () => {
    expect(fillScript("{contato}, vou direto: a {empresa} compra?", full)).toBe("Carlos, vou direto: a Bucha compra?");
  });
  it("sem contato a frase começa sem ele e com maiúscula", () => {
    expect(fillScript("{contato}, vou direto: a {empresa} compra?", { empresa: "Alfa" })).toBe("Vou direto: a Alfa compra?");
    expect(fillScript("Oi, {contato}, tudo bem?", {})).toBe("Oi, tudo bem?");
    expect(fillScript("Falo com {contato} da {empresa}?", {})).toBe("Falo com o responsável da empresa?");
  });
  it("sem nome do vendedor não deixa buraco", () => {
    expect(fillScript("Aqui é {meunome}, da Fey.", {})).toBe("Aqui é da Fey.");
  });
  it("tira LTDA e não grita o nome", () => {
    expect(spokenCompany("MECANICA DO ZE LTDA ME")).toBe("Mecanica do Ze");
    expect(spokenCompany("Fey Fixadores")).toBe("Fey Fixadores");
  });
});
