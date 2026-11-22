import { describe, expect, it } from "vitest";
import { extractContacts, safeUrl } from "@/modules/enrich/web";

describe("enriquecimento pela internet", () => {
  it("acha telefones, e-mail e Instagram e ignora lixo", () => {
    const html = `<a href="tel:+55 (19) 3456-7890">ligue</a><a href="https://wa.me/5519998877665">zap</a>
      <a href="mailto:Vendas@Loja.com.br">e</a><p>Fale: (11) 4002-8922 ou 00000-0000</p><img src="logo@2x.png">
      <a href="https://instagram.com/lojadoze/">ig</a> contato@sentry.io`;
    const f = extractContacts(html);
    expect(f.phones).toEqual(expect.arrayContaining(["1934567890", "19998877665", "1140028922"]));
    expect(f.phones).not.toContain("0000000000");
    expect(f.emails).toContain("vendas@loja.com.br");
    expect(f.emails.some((e) => /sentry|2x/.test(e))).toBe(false);
    expect(f.instagram).toBe("https://instagram.com/lojadoze");
  });
  it("recusa endereços internos (proteção do servidor)", async () => {
    for (const u of ["http://localhost/x", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1", "http://169.254.169.254/latest", "file:///etc/passwd", "http://user:pw@exemplo.com"]) expect(await safeUrl(u), u).toBeNull();
  });
});

import { belongsToCompany, bioLinks, candidateDomains, decodeCfEmail, internalLinks, socialLinks } from "@/modules/enrich/site-parse";

describe("leitura profunda de sites", () => {
  it("acha e-mails escondidos (Cloudflare, [at], entidades) e telefones em dados estruturados", () => {
    const hex = "4a" + [..."vendas@loja.com.br"].map((c) => (c.charCodeAt(0) ^ 0x4a).toString(16).padStart(2, "0")).join("");
    expect(decodeCfEmail(hex)).toBe("vendas@loja.com.br");
    const html = `<a data-cfemail="${hex}"></a><p>financeiro [at] loja [dot] com.br</p><p>cobranca&#64;loja.com.br</p>
      <script type="application/ld+json">{"@type":"Organization","telephone":"+55 11 3333-4444","email":"mailto:Contato@Loja.com.br","sameAs":["https://www.facebook.com/lojaoficial"]}</script>`;
    const f = extractContacts(html);
    expect(f.emails).toEqual(expect.arrayContaining(["vendas@loja.com.br", "financeiro@loja.com.br", "cobranca@loja.com.br", "contato@loja.com.br"]));
    expect(f.phones).toContain("1133334444");
    expect(f.facebook).toBe("https://facebook.com/lojaoficial");
  });
  it("redes sociais ignoram botões de compartilhar", () => {
    const s = socialLinks(`<a href="https://facebook.com/sharer/sharer.php?u=x">c</a><a href="https://www.linkedin.com/company/loja-sa/">l</a><a href="https://instagram.com/p/abc/">x</a>`);
    expect(s).toEqual({ instagram: null, facebook: null, linkedin: "https://linkedin.com/company/loja-sa" });
  });
  it("escolhe links internos de contato primeiro e ignora outros sites e arquivos", () => {
    const base = new URL("https://www.loja.com.br/");
    const l = internalLinks(`<a href="/produtos">Produtos</a><a href="/sobre-nos">Quem somos</a><a href="/fale-conosco">x</a><a href="https://outro.com/contato">c</a><a href="/catalogo.pdf">Contato</a>`, base);
    expect(l.map((x) => x.url)).toEqual(["https://www.loja.com.br/fale-conosco", "https://www.loja.com.br/sobre-nos"]);
  });
  it("segue link na bio", () => { expect(bioLinks(`<a href="https://linktr.ee/lojadoze">bio</a>`)).toEqual(["https://linktr.ee/lojadoze"]); });
  it("descobre o domínio sem confundir com e-mail gratuito ou contador", () => {
    expect(candidateDomains(["a@gmail.com", "x@contabilidadeabc.com.br", "vendas@acme.com.br"], ["ACME PARAFUSOS LTDA"]).map((c) => c.host)).toEqual(["acme.com.br", "acmeparafusos.com.br", "acmeparafusos.com"]);
  });
  it("só aceita o site se a página prova ser da empresa", () => {
    const names = ["Acme Parafusos Ltda", "ACME PARAFUSOS INDUSTRIAIS LTDA"];
    expect(belongsToCompany("<footer>CNPJ 12.345.678/0001-95</footer>", { cnpj: "12345678000195", names, byName: true })).toBe(true);
    expect(belongsToCompany("<title>Acme Parafusos Industriais</title>", { cnpj: "12345678000195", names, byName: false })).toBe(true);
    expect(belongsToCompany("<title>Contabilidade Silva</title>", { cnpj: "12345678000195", names, byName: false })).toBe(false);
    expect(belongsToCompany("<title>Acme Parafusos</title>", { cnpj: "12345678000195", names, byName: true })).toBe(false);
  });
});
