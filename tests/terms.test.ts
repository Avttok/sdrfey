import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTerm, cleanOverrides, RETIRED, term, TERMS } from "@/config/terms";
import { buildRe, replaceDeep } from "@/lib/term-replace";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

describe("glossário", () => {
  it("chaves e nomes padrão são únicos", () => {
    expect(new Set(TERMS.map((t) => t.key)).size).toBe(TERMS.length);
    expect(new Set(TERMS.map((t) => t.label)).size).toBe(TERMS.length);
  });
  it("term() devolve o nome padrão e recusa chave desconhecida", () => {
    expect(term("shuffler_sdr")).toBe("Shuffler Prospecção");
    expect(term("shuffler_sales")).toBe("Shuffler Vendas");
    expect(() => term("nao_existe")).toThrow();
  });
  it("apelido só vale para o texto inteiro", () => {
    const o = { shuffler_sales: "Shuffler Comercial" };
    expect(applyTerm("Shuffler Vendas", o)).toBe("Shuffler Comercial");
    expect(applyTerm("Abrir Shuffler Vendas agora", o)).toBe("Abrir Shuffler Vendas agora");
    expect(applyTerm("Shuffler Vendas", undefined)).toBe("Shuffler Vendas");
  });
  it("cleanOverrides descarta lixo", () => {
    expect(cleanOverrides({ shuffler_sdr: "  Prospecção  ", x: "a", leads: "<b>", metas: "Metas", visitas: 3, dashboard: "a".repeat(80) })).toEqual({ shuffler_sdr: "Prospecção" });
  });
  it("nenhum nome aposentado reaparece no código", () => {
    const bad: string[] = [];
    for (const f of files("src")) {
      if (f.endsWith("config/terms.ts")) continue;
      const txt = readFileSync(f, "utf8");
      for (const r of RETIRED) if (txt.includes(r.text)) bad.push(`${f}: "${r.text}" → use "${r.use}"`);
    }
    expect(bad).toEqual([]);
  });
});

describe("troca de termos", () => {
  it("palavra inteira e maiúsculas", () => {
    const re = buildRe({ from: "Lead", matchCase: false, wholeWord: true });
    expect(replaceDeep("O lead e o leader", re, "Contato")).toEqual({ value: "O Contato e o leader", n: 1 });
    const cs = buildRe({ from: "Lead", matchCase: true, wholeWord: false });
    expect(replaceDeep("lead Lead", cs, "X").value).toBe("lead X");
  });
  it("troca dentro de JSON sem quebrar aspas", () => {
    const re = buildRe({ from: "Shuffler de vendas", matchCase: false, wholeWord: false });
    const r = replaceDeep({ a: ["Abra o Shuffler de vendas"], b: { c: 'diga "Shuffler de vendas"' }, n: 3 }, re, 'Shuffler "Vendas"');
    expect(r.n).toBe(2);
    expect(JSON.parse(JSON.stringify(r.value))).toEqual({ a: ['Abra o Shuffler "Vendas"'], b: { c: 'diga "Shuffler "Vendas""' }, n: 3 });
  });
  it("caracteres especiais do termo não viram regex", () => {
    const re = buildRe({ from: "a.b(c)", matchCase: false, wholeWord: false });
    expect(replaceDeep("a.b(c) axb(c)", re, "Z").value).toBe("Z axb(c)");
  });
});
