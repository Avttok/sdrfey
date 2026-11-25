import { describe, expect, it } from "vitest";
import { buildReport, SECTIONS } from "@/modules/performance/report";

describe("relatório de desempenho", () => {
  for (const kind of ["sdr", "vendas"] as const) {
    it(`${kind}: todas as abas montam, com a aba de contatos e os indicadores novos`, async () => {
      const r = await buildReport({ kind, from: "2026-01-01", to: "2026-01-31", sections: SECTIONS[kind].map((s) => s.id), users: [1], group: "semana" }, { 1: "Teste" });
      expect(r.sheets.map((s) => s.id)).toContain("contatos");
      const resumo = r.sheets.find((s) => s.id === "resumo")!;
      const ks = resumo.rows.map((x) => x.k);
      expect(ks).toContain("Ligações com resultado");
      expect(ks).toContain("Taxa de resposta no WhatsApp");
      if (kind === "vendas") expect(ks).toContain("Negociações paradas");
    });
  }
});
