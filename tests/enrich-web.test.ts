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
