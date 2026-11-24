import { describe, expect, it, vi } from "vitest";
vi.mock("@/db", () => ({ db: {}, scripts: {} }));
import { entryOf, extractModule, moduleOf } from "@/config/script-modules";
import { suggestModules } from "@/config/script-suggest";
import { galeria } from "@/modules/scripts/seed-galeria";
import { SEG } from "@/modules/scripts/seed-core";

describe("galeria de módulos", () => {
  it("em todo tipo de cliente: passos classificados, ligações fechadas, até 10 respostas, volta ao roteiro", () => {
    for (const [seg, s] of Object.entries(SEG)) {
      const k = seg;
      const nodes = galeria(s, k); const ids = new Set(nodes.map((n) => n.id));
      expect(ids.size, seg).toBe(nodes.length);
      for (const n of nodes) {
        expect(moduleOf(n.id), `${seg}/${n.id}`).not.toBeNull();
        expect(n.options.length, `${seg}/${n.id}`).toBeGreaterThan(0);
        expect(n.options.length, `${seg}/${n.id}`).toBeLessThanOrEqual(10);
        for (const o of n.options) expect(o.to === "§voltar" || ids.has(o.to ?? ""), `${seg}/${n.id} -> ${o.to}`).toBe(true);
      }
    }
  });
  it("cada módulo tem entrada e todos os passos são alcançáveis a partir dela", () => {
    const nodes = galeria(SEG.geral); const keys = new Set(nodes.map((n) => moduleOf(n.id)!.key));
    expect(keys.size).toBeGreaterThanOrEqual(9);
    for (const k of keys) {
      const x = extractModule(nodes, k, "g1:"); expect(x, k).not.toBeNull();
      const by = new Map(x!.nodes.map((n) => [n.id, n])); const seen = new Set([x!.entry]); const q = [x!.entry];
      while (q.length) for (const o of by.get(q.shift()!)?.options ?? []) if (o.to && by.has(o.to) && !seen.has(o.to)) { seen.add(o.to); q.push(o.to); }
      expect([...by.keys()].filter((i) => !seen.has(i)), k).toEqual([]);
      expect(entryOf(nodes, k), k).toBeTruthy();
    }
  });
  it("sem resposta no telefone sugere a cadência de WhatsApp", () => {
    const r = suggestModules({ node: "sem_resp", goal: "sdr", objective: null, visited: ["entrada"], current: "entrada", objections: [], good: 0, hurdles: 0 }, ["cadencia", "spin", "visita"], {});
    expect(r[0].key).toBe("cadencia");
  });
  it("depois de “não preciso”, sugere a descoberta com SPIN", () => {
    const r = suggestModules({ goal: "sdr", objective: null, visited: ["entrada", "perfil"], current: "obj:nao_preciso", objections: ["obj:nao_preciso"], good: 0, hurdles: 1 }, ["spin", "concorda", "cadencia"], {});
    expect(r[0].key).toBe("spin");
  });
});
