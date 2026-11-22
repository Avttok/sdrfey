import { describe, expect, it } from "vitest";
import { buildAll } from "@/modules/scripts/seed";
import { nodeSchema } from "@/modules/scripts/schema";

describe("scripts de fábrica: limites do editor", () => {
  it("até 90 passos, ids curtos, até 10 respostas e textos dentro do limite", () => {
    for (const b of buildAll()) {
      expect(b.nodes.length, b.key).toBeLessThanOrEqual(90);
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
  it("scripts de ligação a frio perguntam e usam o nome de quem fala", () => {
    for (const b of buildAll()) {
      const ids = new Set(b.nodes.map((n) => n.id));
      if (!ids.has("secretaria")) continue; // retorno de cotação já conhece a pessoa
      const nome = b.nodes.find((n) => n.id === "nome");
      expect(nome, b.key).toBeTruthy();
      expect(nome!.say).toContain("[[contato?");
      const abertura = b.nodes.find((n) => n.id === "abertura")!;
      expect(abertura.options.some((o) => o.to === "nome"), b.key).toBe(true);
    }
  });
});

describe("scripts de fábrica: triagem de perfil", () => {
  const ROLES = ["p_socio", "p_compras", "p_gestor", "p_balcao", "p_operacao", "p_admin", "p_assistente", "secretaria"];
  it("a abertura é neutra (não faz o pitch antes de saber quem atendeu) e a função leva a um caminho por perfil", () => {
    for (const b of buildAll()) {
      const ab = b.nodes.find((n) => n.id === "abertura")!;
      expect(ab.say, b.key).not.toMatch(/Posso te explicar|trinta segundos|Somos uma metal/i);
      expect(ab.say, b.key).toMatch(/com quem eu falo/i);
      const papel = b.nodes.find((n) => n.id === "papel");
      expect(papel, b.key).toBeTruthy();
      const alvos = new Set(papel!.options.map((x) => x.to));
      for (const r of ROLES) expect(alvos.has(r), `${b.key}:${r}`).toBe(true);
    }
  });
  it("todo passo é alcançável a partir do início e nenhuma resposta aponta para passo inexistente", () => {
    for (const b of buildAll()) {
      const byId = new Map(b.nodes.map((n) => [n.id, n]));
      const seen = new Set<string>();
      const stack = [b.startId];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const n = byId.get(id);
        expect(n, `${b.key}: passo ${id} não existe`).toBeTruthy();
        for (const x of n!.options) if (x.to) stack.push(x.to);
      }
      const orfaos = b.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
      expect(orfaos, b.key).toEqual([]);
    }
  });
});
