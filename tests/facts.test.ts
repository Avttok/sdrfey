import { describe, expect, it } from "vitest";
import { cleanValue, FIELD_SEED, isStale, missingFields, MULTI_SEP, type FactView } from "@/config/facts";
import { buildAll } from "@/modules/scripts/seed";

const defs = FIELD_SEED.map((f) => ({ ...f, active: true }));
const byKey = new Map(defs.map((d) => [d.key, d]));

describe("dados que o roteiro grava", () => {
  it("toda resposta e pergunta dos roteiros de fábrica aponta para um campo válido, com valor aceito", () => {
    const bad: string[] = [];
    for (const s of buildAll()) for (const n of s.nodes) {
      for (const a of n.ask ?? []) if (!byKey.has(a.key)) bad.push(`${s.key}/${n.id}: pergunta ${a.key}`);
      for (const o of n.options) if (o.fact) {
        const d = byKey.get(o.fact.key);
        if (!d) { bad.push(`${s.key}/${n.id}: campo ${o.fact.key}`); continue; }
        if (!cleanValue(d, o.fact.value)) bad.push(`${s.key}/${n.id}: valor ${o.fact.value}`);
        if ((d.kind === "lista") && !d.options.includes(o.fact.value)) bad.push(`${s.key}/${n.id}: ${o.fact.value} fora das opções de ${d.key}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("os roteiros de prospecção de fato gravam dados", () => {
    const sdr = buildAll().find((s) => s.key === "sdr:geral")!;
    expect(sdr.nodes.some((n) => n.options.some((o) => o.fact))).toBe(true);
    expect(sdr.nodes.some((n) => n.ask?.length)).toBe(true);
  });
  it("valida o valor de acordo com o tipo", () => {
    expect(cleanValue({ kind: "simnao", options: [] }, "Talvez")).toBeNull();
    expect(cleanValue({ kind: "simnao", options: [] }, "Sim")).toBe("Sim");
    expect(cleanValue({ kind: "numero", options: [] }, "1.500,5")).toBe("1500.5");
    expect(cleanValue({ kind: "numero", options: [] }, "muito")).toBeNull();
    expect(cleanValue({ kind: "multi", options: ["A", "B"] }, `A${MULTI_SEP}B${MULTI_SEP}A`)).toBe(`A${MULTI_SEP}B`);
    expect(cleanValue({ kind: "texto", options: [] }, "   ")).toBeNull();
  });
  it("dado velho vence pelo prazo do campo", () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    expect(isStale(180, old)).toBe(true);
    expect(isStale(365, old)).toBe(false);
    expect(isStale(null, old)).toBe(false);
  });
  it("a próxima pergunta é o campo mais valioso que falta, e o velho volta à fila", () => {
    const f = (key: string, daysAgo: number): FactView => ({ key, value: "x", confidence: 1, at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), personId: null, by: null });
    const next = missingFields(defs, [f("aplicacao", 1), f("quando", 90)], false, 20);
    expect(next.map((n) => n.def.key)).not.toContain("aplicacao");
    expect(next[0].def.key).toBe("mix");
    expect(next.find((n) => n.def.key === "quando")?.why).toBe("velho");
    expect(missingFields(defs, [], false, 20).every((n) => n.def.scope === "lead")).toBe(true);
  });
});
