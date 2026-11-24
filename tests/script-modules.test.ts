import { describe, expect, it } from "vitest";
import { buildAll } from "@/modules/scripts/seed";
import { extractModule, flowOf, moduleOf, nodesOfModule, entryOf } from "@/config/script-modules";
import { suggestModules } from "@/config/script-suggest";

const all = buildAll();

describe("módulos de roteiro", () => {
  it("todo passo de todo roteiro de fábrica pertence a um módulo", () => {
    const sem = new Set<string>();
    for (const s of all) for (const n of s.nodes) if (!moduleOf(n.id)) sem.add(n.id);
    expect([...sem]).toEqual([]);
  });
  it("a sequência de módulos começa na abertura e chega ao final", () => {
    for (const s of all) { const f = flowOf(s.nodes, s.startId); expect(f.modules[0].key, s.key).toBe("entrada"); expect(f.modules.some((m) => m.category === "final"), s.key).toBe(true); }
  });
  it("módulo da galeria encaixa em outro roteiro sem ponta solta", () => {
    const sdr = all.find((s) => s.goal === "sdr" && s.segment === "geral")!; const vendas = all.find((s) => s.goal === "vendas" && s.segment === "geral")!;
    for (const key of ["descoberta", "minimo", "obj:preco", "proposta", "visita"]) {
      const x = extractModule(vendas.nodes, key, "g1:") ?? extractModule(sdr.nodes, key, "g1:");
      expect(x, key).not.toBeNull();
      const ids = new Set(x!.nodes.map((n) => n.id));
      expect(ids.has(x!.entry)).toBe(true);
      for (const n of x!.nodes) for (const o of n.options) for (const t of [o.to, ...Object.values(o.goto ?? {})]) if (t) expect(ids.has(t) || t === "§voltar", `${n.id} -> ${t}`).toBe(true);
    }
  });
  it("entrada de módulo existe no roteiro", () => { const s = all.find((x) => x.goal === "sdr" && x.segment === "geral")!; expect(entryOf(s.nodes, "visita")).toBe("visita"); expect(nodesOfModule(s.nodes, "obj:preco")).toHaveLength(1); });
});

describe("sugestões", () => {
  const base = { goal: "sdr", objective: null, visited: ["entrada", "perfil"], current: "perfil", objections: [] as string[], good: 0, hurdles: 0 };
  const keys = ["minimo", "descoberta", "visita", "pitch", "obj:preco", "obj:valor"];
  it("depois da objeção de preço sugere o mínimo", () => {
    const r = suggestModules({ ...base, objections: ["obj:preco"], hurdles: 1 }, keys, {});
    expect(r[0].key).toBe("minimo");
  });
  it("com bons sinais sugere o fechamento da categoria", () => {
    expect(suggestModules({ ...base, good: 3 }, keys, {})[0].key).toBe("visita");
  });
  it("os dados das ligações mudam a ordem quando há volume", () => {
    const ctx = { ...base, objections: ["obj:preco"], hurdles: 1 };
    const r = suggestModules(ctx, keys, { minimo: { uses: 40, wins: 4, stops: 20, taken: 5 }, descoberta: { uses: 40, wins: 34, stops: 3, taken: 9 } }, 5);
    const pos = (k: string) => r.findIndex((s) => s.key === k);
    expect(pos("descoberta")).toBeGreaterThanOrEqual(0);
    expect(pos("minimo") === -1 || pos("descoberta") < pos("minimo")).toBe(true);
    expect(r.find((s) => s.key === "descoberta")!.why).toMatch(/%/);
  });
  it("não sugere módulo já percorrido", () => { expect(suggestModules({ ...base, visited: [...base.visited, "visita"] }, keys, {}).some((s) => s.key === "visita")).toBe(false); });
});
