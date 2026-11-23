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

import { parseEoxUrl, qualificationUrl } from "@/modules/vocall/eox";
describe("link da EOX", () => {
  it("tira o cadastro do link", () => {
    expect(parseEoxUrl("https://fey.vocallcontact.com.br/index.php?module=Accounts&view=Detail&record=1293925")).toEqual({ crmid: "1293925", setype: "Accounts", origin: "https://fey.vocallcontact.com.br" });
    expect(parseEoxUrl("index.php?module=Contacts&record=77&x=1")).toEqual({ crmid: "77", setype: "Contacts", origin: "" });
    expect(parseEoxUrl("https://exemplo.com/sem-record")).toBeNull();
    expect(parseEoxUrl(null)).toBeNull();
  });
});

describe("link de qualificação da EOX", () => {
  it("igual ao que a EOX monta quando a ligação sai por ela", () => {
    expect(qualificationUrl({ crmid: "1293925", setype: "Accounts", origin: "https://fey.vocallcontact.com.br" }, "544043")).toBe("https://fey.vocallcontact.com.br/index.php?module=Atendimentos&view=Edit&sourceuuid=544043&parent_id=1293925&campanha=undefined&origem_atendimento=Telefone%20Ativo&contact_id=0");
  });
  it("contato sem empresa vai em contact_id", () => {
    expect(qualificationUrl({ crmid: "77", setype: "Contacts", origin: "https://e.com" }, "9")).toContain("parent_id=&campanha=undefined&origem_atendimento=Telefone%20Ativo&contact_id=77");
  });
});
