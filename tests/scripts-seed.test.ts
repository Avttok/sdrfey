import { describe, expect, it, vi } from "vitest";
vi.mock("@/db", () => ({ db: {}, scripts: {} }));
import { checkTree } from "@/modules/scripts/schema";
import { buildAll } from "@/modules/scripts/seed";

describe("scripts de fábrica", () => {
  it("toda árvore é válida, fechada e termina em um fim", () => {
    for (const { key, nodes, startId } of buildAll()) {
      expect(checkTree(nodes, startId), key).toBeNull();
      for (const n of nodes) if (n.type === "fala") for (const o of n.options) expect(o.to, `${key}/${n.id}`).not.toBeNull();
      expect(nodes.some((n) => n.type === "fim"), key).toBe(true);
    }
  });
});

describe("revisão dos textos de fábrica", async () => {
  const { FIELD_SEED_BY_KEY } = await import("@/config/facts");
  const { SEG } = await import("@/modules/scripts/seed-core");
  const { galeria } = await import("@/modules/scripts/seed-galeria");
  /** A galeria (módulos extras) passa pelas mesmas regras de texto, em todos os tipos de cliente. */
  const all = [...buildAll(), ...Object.keys(SEG).map((k) => ({ key: `galeria:${k}`, goal: "galeria" as never, segment: k, nodes: galeria(SEG[k], k), startId: "" }))];
  const texts = (n: (typeof all)[number]["nodes"][number]) => [["n", n.say], ["f", n.v?.formal], ["s", n.v?.solto]].filter((x): x is [string, string] => !!x[1]);
  const L = "(?<![\\p{L}])", R = "(?![\\p{L}])";
  const re = (w: string, f = "iu") => new RegExp(`${L}(${w})${R}`, f);
  const known = new Set(["saudacao", "meunome", "empresa", "empresa_completa", "contato", "cidade"]);

  it("só usa variáveis conhecidas, valores e descontos da regra comercial", () => {
    for (const b of all) for (const n of b.nodes) for (const [, t] of texts(n)) {
      for (const m of t.matchAll(/\{(\w+)\}/g)) expect(known.has(m[1]), `${b.key}/${n.id}: {${m[1]}}`).toBe(true);
      for (const m of t.matchAll(/R\$ ?\d{1,3}(?:\.\d{3})*/g)) expect(["R$ 3.500", "R$ 2.500"], `${b.key}/${n.id}`).toContain(m[0]);
      for (const m of t.matchAll(/(\d+)\s?%/g)) expect(["25", "26"], `${b.key}/${n.id}`).toContain(m[1]);
    }
  });

  it("tons: o formal não fica coloquial, o solto não fica engessado, e nada proibido aparece", () => {
    for (const b of all) for (const n of b.nodes) {
      for (const [tone, t] of texts(n)) {
        expect(re("tem um minuto|senhor|senhora|barreira|vou estar|estarei enviando|videochamada|zoom|teams").test(t), `${b.key}/${n.id}:${tone} proibido`).toBe(false);
        expect(re("de o|a o|em o|de a|que que|o o|a a|de de|da da").test(t), `${b.key}/${n.id}:${tone} contração/repetição`).toBe(false);
        expect(/ {2,}| ,|,,|\?\?/.test(t), `${b.key}/${n.id}:${tone} pontuação`).toBe(false);
        if (tone === "f") expect(re("tô|tá|pra|pro|a gente|né|beleza|valeu|rapidinho|perrengue|fechou").test(t), `${b.key}/${n.id} formal coloquial`).toBe(false);
        if (tone === "s") expect(re("gostaria|poderia|por gentileza|prezado").test(t), `${b.key}/${n.id} solto engessado`).toBe(false);
      }
    }
  });

  it("soa como conversa: sem dois-pontos nas falas e sem frases de manual", () => {
    for (const b of all) for (const n of b.nodes) if (n.type === "fala") for (const [tone, t] of texts(n)) {
      expect(/:/.test(t), `${b.key}/${n.id}:${tone} dois-pontos`).toBe(false);
      expect(re("em duas frases|só uma pergunta|me tira uma curiosidade|vou ser transparente já de cara|só me conta").test(t), `${b.key}/${n.id}:${tone} frase de manual`).toBe(false);
    }
  });

  it("amigável em todos os tons: nada que trate a pessoa como incômodo, sem importância ou culpada", () => {
    for (const b of all) for (const n of b.nodes) for (const [tone, t] of texts(n)) {
      expect(re("atrapalh\\w*|incomod\\w* à toa|à toa|nem é com (você|vc)|perder (o seu |seu |meu )?tempo|não é da sua conta|você não entendeu|não entendeu|óbvio|obviamente|como eu disse|burr\\w+|estúpid\\w+").test(t), `${b.key}/${n.id}:${tone} tom pouco amigável`).toBe(false);
    }
  });

  it("os dados que o roteiro grava existem no catálogo e vêm da lista", () => {
    for (const b of all) for (const n of b.nodes) {
      for (const a of n.ask ?? []) expect(FIELD_SEED_BY_KEY.has(a.key), `${b.key}/${n.id} pergunta ${a.key}`).toBe(true);
      for (const o of n.options) if (o.fact) {
        const d = FIELD_SEED_BY_KEY.get(o.fact.key);
        expect(d, `${b.key}/${n.id} campo ${o.fact.key}`).toBeTruthy();
        if (d && d.kind !== "texto" && d.kind !== "numero") expect(d.options, `${b.key}/${n.id}: ${o.fact.value}`).toContain(o.fact.value);
      }
    }
  });

  it("indicação de cliente não vira venda, e o Retorno não pula da objeção direto para fechar o pedido", () => {
    for (const b of all.filter((x) => x.goal === "fidelizar")) {
      const ind = b.nodes.find((n) => n.id === "fid_indica")!;
      expect(ind.options.find((o) => /indicou/i.test(o.label))?.to, b.key).toBe("fim_indicacao");
      expect(b.nodes.find((n) => n.id === "fim_indicacao")?.outcome, b.key).toBe("indicacao");
      for (const o of b.nodes.find((n) => n.id === "fid_indica_venda")!.options) expect(o.to, b.key).toBe("fim_venda");
    }
    for (const b of all.filter((x) => x.goal === "retorno")) for (const n of b.nodes.filter((x) => x.id.startsWith("obj_"))) for (const o of n.options) expect(o.to, `${b.key}/${n.id}`).not.toBe("fechar");
  });

  it("a fala do balcão só fala de balcão para quem revende", () => {
    for (const b of all.filter((x) => x.goal !== "visita")) {
      const tipo = (SEG[b.segment] ?? SEG.geral).tipo;
      const say = b.nodes.find((n) => n.id === "p_balcao")?.say ?? "";
      if (tipo !== "revenda") expect(/balc[ãa]o/i.test(say), `${b.key}`).toBe(false);
    }
  });
});
