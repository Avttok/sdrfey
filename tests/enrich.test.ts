import { describe, expect, it } from "vitest";
import { mergeInfo, parseBrasilApi, parsePhones, parseReceitaWs, statusToSituation } from "@/modules/enrich/parse";

describe("consulta de CNPJ", () => {
  it("lê telefones em vários formatos e corrige celular de 8 dígitos", () => {
    expect(parsePhones("(65) 3333-2000 / (65) 98114-2000")).toEqual(["6533332000", "65981142000"]);
    expect(parsePhones("6581142000")).toEqual(["65981142000"]);
    expect(parsePhones("556533332000")).toEqual(["6533332000"]);
    expect(parsePhones("123")).toEqual([]);
  });
  it("BrasilAPI", () => {
    const i = parseBrasilApi({ cnpj: "1", razao_social: "A LTDA", nome_fantasia: "A", descricao_situacao_cadastral: "Ativa", municipio: "CUIABA", uf: "mt", ddd_telefone_1: "6533332000", email: "X@A.com", capital_social: 5000, qsa: [{ nome_socio: "JOAO", qualificacao_socio: "Sócio" }] });
    expect(i).toMatchObject({ status: "ATIVA", uf: "MT", emails: ["x@a.com"], capital: 5000, tradeName: "A" });
    expect(i!.partners).toEqual([{ name: "JOAO", role: "Sócio" }]);
  });
  it("ReceitaWS (e erro)", () => {
    const i = parseReceitaWs({ cnpj: "1", nome: "A", fantasia: "", situacao: "BAIXADA", abertura: "05/03/2010", capital_social: "10000.00", telefone: "(65) 3333-2000" });
    expect(i).toMatchObject({ status: "BAIXADA", openedAt: "2010-03-05", capital: 10000, tradeName: null, phones: ["6533332000"] });
    expect(parseReceitaWs({ status: "ERROR", message: "Too many requests" })).toBeNull();
  });
  it("junta as fontes somando contatos", () => {
    const a = parseBrasilApi({ cnpj: "1", ddd_telefone_1: "6533332000", descricao_situacao_cadastral: "ATIVA" });
    const b = parseReceitaWs({ cnpj: "1", telefone: "(65) 98114-2000", email: "b@b.com", fantasia: "Fantasia" });
    expect(mergeInfo(a, b)).toMatchObject({ phones: ["6533332000", "65981142000"], emails: ["b@b.com"], tradeName: "Fantasia", status: "ATIVA" });
    expect(mergeInfo(null, null)).toBeNull();
  });
  it("situação cadastral → tag", () => {
    expect(statusToSituation("ATIVA")).toBeNull();
    expect(statusToSituation("BAIXADA")).toBe("baixada");
    expect(statusToSituation("NULA")).toBe("auto_descarte");
  });
});
