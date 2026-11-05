import { describe, expect, it } from "vitest";
import { classifyCapital, classifyPorte } from "@/modules/enrich/classify";
import { selectedRows } from "@/modules/enrich/flatten";
import { groupAudit } from "@/modules/audit/query";

describe("porte e capital (regras da planilha)", () => {
  it("MEI: microempresa + natureza individual", () => {
    expect(classifyPorte({ porte: "MICRO EMPRESA", activity: null, capital: 1000, nature: "Empresário (Individual)", isMei: true })).toBe("MEI (1 FUNC.)");
  });
  it("ME, EPP, médio e grande", () => {
    const b = { activity: null, capital: 0, nature: "Sociedade Empresária Limitada", isMei: false };
    expect(classifyPorte({ ...b, porte: "MICRO EMPRESA" })).toBe("ME (ATÉ 9 FUNC.)");
    expect(classifyPorte({ ...b, porte: "EMPRESA DE PEQUENO PORTE" })).toBe("EPP (10 A 49 FUNC.)");
    expect(classifyPorte({ ...b, porte: "MÉDIO" })).toBe("MÉDIA (50 A 99 FUNC.)");
    expect(classifyPorte({ ...b, porte: "GRANDE" })).toBe("GRANDE (100+ FUNC.)");
  });
  it("DEMAIS: indústria, capital alto ou baixo", () => {
    const b = { porte: "DEMAIS", nature: null, isMei: false };
    expect(classifyPorte({ ...b, activity: "Fabricação de peças", capital: 10 })).toBe("INDUSTRIA (500+ FUNC.)");
    expect(classifyPorte({ ...b, activity: "Comércio", capital: 600000 })).toBe("GRANDE (100+ FUNC.)");
    expect(classifyPorte({ ...b, activity: "Comércio", capital: 5000 })).toBe("MÉDIA (50 A 99 FUNC.)");
  });
  it("faixa de capital: maior limite alcançado, mínimo R$ 1.000", () => {
    expect(classifyCapital(12500)).toEqual({ label: "R$ 10.000", value: 10000 });
    expect(classifyCapital(300)).toEqual({ label: "R$ 1.000", value: 1000 });
    expect(classifyCapital(2_000_000)?.label).toBe("R$ 1.000.000");
    expect(classifyCapital(null)).toBeNull();
  });
});

describe("Ver todas as informações", () => {
  it("ReceitaWS na ordem combinada, só o que veio", () => {
    const rows = selectedRows("ReceitaWS", {
      tipo: "MATRIZ", porte: "DEMAIS", simei: { optante: false, ultima_atualizacao: "2022-01-05" }, simples: { optante: true, ultima_atualizacao: "2023-02-10" },
      data_situacao: "03/05/2020", atividade_principal: [{ code: "47.89-0-99", text: "Comércio varejista" }],
      atividades_secundarias: [{ code: "00.00-0-00", text: "Não informada" }, { code: "47.12-1-00", text: "Minimercados" }],
      qsa: [{ nome: "JOAO", qual: "49-Sócio-Administrador" }], extra: "ignorado",
    });
    expect(rows.map((r) => r.label)).toEqual(["Tipo", "Porte", "MEI", "Data MEI", "SIMPLES", "Data SIMPLES", "Data Situação", "Atividade principal", "Atividade secundária 1", "Atividade secundária 2", "Sócio 1"]);
    expect(rows.find((r) => r.label === "Data MEI")?.value).toBe("05/01/2022");
    expect(rows.find((r) => r.label === "Atividade principal")?.value).toBe("4789-0/99 - Comércio varejista");
    expect(rows.find((r) => r.label === "Sócio 1")?.value).toBe("JOAO — 49-Sócio-Administrador");
  });
  it("BrasilAPI", () => {
    const rows = selectedRows("BrasilAPI", { descricao_identificacao_matriz_filial: "FILIAL", descricao_porte: "", porte: "DEMAIS", opcao_pelo_mei: false, cnae_fiscal: 4789099, cnae_fiscal_descricao: "Comércio", cnaes_secundarios: [{ codigo: 4712100, descricao: "Minimercados" }], qsa: [{ nome_socio: "MARIA", qualificacao_socio: "Sócio" }] });
    expect(rows.map((r) => r.label)).toEqual(["Tipo", "Porte", "MEI", "Atividade principal", "Atividade secundária 1", "Sócio 1"]);
  });
});

describe("Registro agrupado", () => {
  const r = (id: number, min: number, userId = 1, leadId: number | null = 5, entity = "lead") => ({ id, at: new Date(Date.UTC(2026, 0, 1, 12, 60 - min)), userId, leadId, entity, action: "a" }) as never;
  it("junta alterações seguidas da mesma pessoa no mesmo lead", () => {
    const g = groupAudit([r(4, 1), r(3, 2), r(2, 3), r(1, 40)]);
    expect(g.map((x) => x.rows.length)).toEqual([3, 1]);
  });
  it("separa pessoas e leads diferentes", () => {
    expect(groupAudit([r(3, 1), r(2, 2, 2), r(1, 3, 1, 9)]).length).toBe(3);
  });
});
