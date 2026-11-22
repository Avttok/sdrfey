import { describe, expect, it } from "vitest";
import { buildAll } from "@/modules/scripts/seed";
import { nodeSchema } from "@/modules/scripts/schema";

describe("scripts de fábrica: limites do editor", () => {
  it("até 60 passos, ids curtos, até 10 respostas e textos dentro do limite", () => {
    for (const b of buildAll()) {
      expect(b.nodes.length, b.key).toBeLessThanOrEqual(60);
      for (const n of b.nodes) {
        expect(n.id.length, `${b.key}:${n.id}`).toBeLessThanOrEqual(24);
        expect(n.options.length, `${b.key}:${n.id}`).toBeLessThanOrEqual(10);
        expect(nodeSchema.safeParse(n).success, `${b.key}:${n.id}`).toBe(true);
      }
    }
  });
  it("sem termos de jogo nos textos", () => {
    for (const b of buildAll()) for (const n of b.nodes) expect(`${n.title} ${n.say} ${n.tip ?? ""}`, `${b.key}:${n.id}`).not.toMatch(/\bjog(o|ar)\b|\bmiss[aã]o\b/i);
  });
});
