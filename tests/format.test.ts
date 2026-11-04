import { describe, expect, it } from "vitest";
import { dayEnd, dayStart, fmtDate, fmtDateTime, fmtDuration } from "@/lib/format";
import { renderTemplate, mailtoLink } from "@/modules/email/render";

describe("datas em Brasília", () => {
  it("DD/MM/AAAA e hora de Brasília (UTC-3)", () => {
    expect(fmtDate(new Date("2026-11-04T02:30:00Z"))).toBe("03/11/2026"); // ainda é dia 3 em Brasília
    expect(fmtDateTime(new Date("2026-11-04T21:52:00Z"))).toBe("04/11/2026 18:52");
    expect(fmtDate(null)).toBe("—");
  });
  it("início e fim do dia são de Brasília", () => {
    expect(dayStart("2026-11-04").toISOString()).toBe("2026-11-04T03:00:00.000Z");
    expect(dayEnd("2026-11-04").toISOString()).toBe("2026-11-05T02:59:59.999Z");
  });
  it("duração", () => expect(fmtDuration(125)).toBe("2m05s"));
});

describe("modelos de e-mail", () => {
  it("preenche variáveis e alternativas", () => {
    expect(renderTemplate("Olá, {contato|tudo bem}! Sou {meu_nome} da {empresa}.", { meu_nome: "Ruan", empresa: "ACME", contato: null })).toBe("Olá, tudo bem! Sou Ruan da ACME.");
    expect(renderTemplate("Oi {contato|x}", { contato: "Maria" })).toBe("Oi Maria");
    expect(renderTemplate("{desconhecida}", {})).toBe("{desconhecida}");
  });
  it("mailto codifica acentos e quebras", () => {
    expect(mailtoLink("a@b.com", "Olá & você", "linha1\nlinha2")).toBe("mailto:a%40b.com?subject=Ol%C3%A1%20%26%20voc%C3%AA&body=linha1%0Alinha2");
  });
});
