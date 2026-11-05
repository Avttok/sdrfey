import { describe, expect, it } from "vitest";
import { fmtAge, fmtCnae } from "@/lib/format";
import { flattenRaw } from "@/modules/enrich/flatten";
import { mergeInfo, parseBrasilApi, parseReceitaWs } from "@/modules/enrich/parse";

const now = new Date("2026-11-04T12:00:00Z");

describe("tempo de atividade", () => {
  it("anos e meses, com plural certo", () => {
    expect(fmtAge("2025-08-04", now)).toBe("1 ano e 3 meses");
    expect(fmtAge("2025-10-25", now)).toBe("1 ano"); // 1 ano e 10 dias
    expect(fmtAge("2026-10-25", now)).toBe("menos de 1 mês");
    expect(fmtAge("2025-11-04", now)).toBe("1 ano");
    expect(fmtAge("2024-11-04", now)).toBe("2 anos");
    expect(fmtAge("2026-12-30", now)).toBeNull(); // data no futuro
    expect(fmtAge("2025-12-30", now)).toBe("10 meses");
    expect(fmtAge("2026-06-04", now)).toBe("5 meses");
    expect(fmtAge("2026-10-04", now)).toBe("1 mês");
    expect(fmtAge("2020-01-10", now)).toBe("6 anos e 9 meses");
    expect(fmtAge("2025-10-20", now)).toBe("1 ano"); // 1 ano e 15 dias → 1 ano
    expect(fmtAge(null, now)).toBeNull();
  });
  it("CNAE formatado", () => {
    expect(fmtCnae(4789099)).toBe("4789-0/99");
    expect(fmtCnae("47.89-0-99")).toBe("4789-0/99");
  });
});

describe("todas as informações", () => {
  it("lista tudo que não é vazio e ignora o resto", () => {
    const rows = flattenRaw({ razao_social: "A LTDA", nome_fantasia: "", email: null, qsa: [{ nome_socio: "JOAO" }, { nome_socio: "MARIA", cpf: "" }], opcao_pelo_mei: false, capital_social: 5000, vazio: [], obj: {} });
    expect(rows).toEqual([
      { label: "Razao social", value: "A LTDA" },
      { label: "Qsa 1 › Nome socio", value: "JOAO" },
      { label: "Qsa 2 › Nome socio", value: "MARIA" },
      { label: "Opcao pelo mei", value: "Não" },
      { label: "Capital social", value: "5000" },
    ]);
  });
});

describe("endereço e CNAE vindos das consultas", () => {
  it("BrasilAPI e ReceitaWS", () => {
    const a = parseBrasilApi({ cnpj: "1", descricao_tipo_de_logradouro: "RUA", logradouro: "DAS FLORES", numero: "123", bairro: "CENTRO", cep: "78000000", cnae_fiscal: 4789099, cnae_fiscal_descricao: "Comércio" });
    expect(a).toMatchObject({ cnae: "4789-0/99", address: { street: "RUA DAS FLORES", number: "123", cep: "78000000" } });
    const b = parseReceitaWs({ cnpj: "1", logradouro: "R A", numero: "9", cep: "78.000-000", atividade_principal: [{ code: "47.89-0-99", text: "Comércio" }] });
    expect(b).toMatchObject({ cnae: "4789-0/99", address: { street: "R A", cep: "78000000" } });
    expect(mergeInfo(a, b)!.address.street).toBe("RUA DAS FLORES");
  });
});
