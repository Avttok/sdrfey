import { describe, expect, it } from "vitest";
import { htmlToText, renderHtml, sanitizeHtml } from "@/modules/email/render";

describe("e-mail formatado", () => {
  it("mantém formatação e remove scripts, on* e javascript:", () => {
    const out = sanitizeHtml('<b>oi</b><script>x()</script><img src="javascript:1" onerror="x()"><span style="color:red">a</span><iframe src="x"></iframe>');
    expect(out).toContain("<b>oi</b>");
    expect(out).toContain('style="color:red"');
    expect(out).not.toMatch(/script|onerror|javascript:|iframe/i);
  });
  it("troca variáveis escapando o valor", () => {
    expect(renderHtml("<p>Olá {contato|tudo bem}, {empresa}</p>", { empresa: "<b>X</b>" })).toBe("<p>Olá tudo bem, &lt;b&gt;X&lt;/b&gt;</p>");
  });
  it("gera texto simples", () => {
    expect(htmlToText("<div>Oi</div><div>Tchau<br>fim</div>")).toBe("Oi\nTchau\nfim");
  });
});
