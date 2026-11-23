import { describe, expect, it } from "vitest";
import { parseVocall } from "@/modules/vocall/config";

describe("configuração do VocallAgent", () => {
  it("limpa o endereço e usa padrões seguros", () => {
    const c = parseVocall({ on: true, host: "wss://agent.exemplo.com.br:8001/vocallagent", port: "x", prefix: "0 a" });
    expect(c.host).toBe("agent.exemplo.com.br");
    expect(c.port).toBe(8001);
    expect(c.secure).toBe(true);
    expect(c.prefix).toBe("0");
  });
  it("sem nada vem desligado", () => { expect(parseVocall(undefined).on).toBe(false); });
});

describe("qualificação da ligação", () => {
  it("sem lista vem o padrão; linhas sem texto saem e o nome cai no texto", () => {
    expect(parseVocall({}).quals.length).toBeGreaterThan(0);
    const q = parseVocall({ quals: [{ label: "", texto: " Atendida " }, { label: "x", texto: "" }, 5] }).quals;
    expect(q).toEqual([{ label: "Atendida", texto: "Atendida" }]);
  });
});
