import { createHash } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eoxAccountsPage, eoxFindByCnpj, eoxLink, eoxLogin, recordOf } from "@/modules/eox/client";
import { parseEox } from "@/modules/eox/config";

const cfg = parseEox({ on: true, baseUrl: "fey.exemplo.com.br/index.php", username: "robo", accessKey: "segredo", cnpjField: "cf_850" });

/** EOX de mentira: fala o protocolo do Vtiger (desafio → login com md5 → consultas). */
function fakeEox(accounts: { id: string; cf_850: string }[]) {
  const seen: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const op = u.searchParams.get("operation") ?? new URLSearchParams(String(init?.body ?? "")).get("operation");
    const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
    if (op === "getchallenge") return ok({ token: "TOK" });
    if (op === "login") {
      const b = new URLSearchParams(String(init?.body));
      if (b.get("accessKey") !== createHash("md5").update("TOKsegredo").digest("hex")) return new Response(JSON.stringify({ success: false, error: { message: "chave errada" } }));
      return ok({ sessionName: "SESS" });
    }
    const q = u.searchParams.get("query") ?? ""; seen.push(q);
    if (u.searchParams.get("sessionName") !== "SESS") return new Response(JSON.stringify({ success: false, error: { message: "sem sessão" } }));
    const lim = /LIMIT (\d+), (\d+)/.exec(q);
    if (lim) return ok(accounts.slice(Number(lim[1]), Number(lim[1]) + Number(lim[2])));
    const m = /= '(\d{14})'/.exec(q);
    return ok(accounts.filter((a) => a.cf_850.replace(/\D/g, "") === m?.[1]).map((a) => ({ id: a.id })));
  }) as unknown as typeof fetch;
  return { f, seen };
}

describe("cliente da API da EOX", () => {
  it("normaliza o endereço e entende o id", () => {
    expect(cfg.baseUrl).toBe("https://fey.exemplo.com.br");
    expect(recordOf("6x1293925")).toBe("1293925");
    expect(recordOf("lixo")).toBeNull();
    expect(eoxLink(cfg.baseUrl, "Accounts", "1")).toBe("https://fey.exemplo.com.br/index.php?module=Accounts&view=Detail&record=1");
  });
  it("login com md5; chave errada dá erro claro", async () => {
    const { f } = fakeEox([]);
    expect((await eoxLogin(cfg, f)).session).toBe("SESS");
    await expect(eoxLogin({ ...cfg, accessKey: "errada" }, f)).rejects.toThrow("chave errada");
  });
  it("lê em páginas de 100, ignora CNPJ inválido e acha por CNPJ com máscara", async () => {
    const accs = Array.from({ length: 130 }, (_, i) => ({ id: `6x${1000 + i}`, cf_850: i === 5 ? "sem cnpj" : `11.222.333/${String(i).padStart(4, "0")}-81` }));
    const { f } = fakeEox(accs);
    const s = await eoxLogin(cfg, f);
    const p1 = await eoxAccountsPage(s, 0), p2 = await eoxAccountsPage(s, 100);
    expect(p1.end).toBe(false); expect(p2.end).toBe(true);
    expect(p1.rows.length).toBe(99); expect(p2.rows.length).toBe(30);
    expect(await eoxFindByCnpj(s, "11222333000781")).toBe("1007");
    expect(await eoxFindByCnpj(s, "123")).toBeNull();
  });
});

const HAS_DB = !!process.env.DATABASE_URL;
describe.skipIf(!HAS_DB)("preencher o link da EOX nos leads (banco real)", () => {
  let m: { db: typeof import("@/db"); sync: typeof import("@/modules/eox/sync") };
  beforeAll(async () => {
    m = { db: await import("@/db"), sync: await import("@/modules/eox/sync") };
    await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZEOX%"));
    await m.db.db.insert(m.db.leads).values([
      { cnpj: "11222333000181", company: "ZZEOX A", isTest: true },
      { cnpj: "11.222.333/0002-62", company: "ZZEOX B", isTest: true },
      { cnpj: "11222333000343", company: "ZZEOX C", isTest: true, eoxUrl: "https://meu-link" },
      { cnpj: "11222333000424", company: "ZZEOX D", isTest: true },
    ]);
  });
  afterAll(async () => { await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZEOX%")); });
  it("liga por CNPJ (com ou sem máscara), não troca link existente e não inventa", async () => {
    const map = new Map([["11222333000181", "1"], ["11222333000262", "2"], ["11222333000343", "3"]]);
    const n = await m.sync.linkLeads(m.db.db, cfg.baseUrl, "Accounts", map, null);
    expect(n).toBe(2);
    const rows = await m.db.db.select().from(m.db.leads).where(like(m.db.leads.company, "ZZEOX%"));
    const by = Object.fromEntries(rows.map((r) => [r.company, r.eoxUrl]));
    expect(by["ZZEOX A"]).toBe("https://fey.exemplo.com.br/index.php?module=Accounts&view=Detail&record=1");
    expect(by["ZZEOX B"]).toContain("record=2");
    expect(by["ZZEOX C"]).toBe("https://meu-link");
    expect(by["ZZEOX D"]).toBeNull();
    expect(await m.sync.linkLeads(m.db.db, cfg.baseUrl, "Accounts", map, null)).toBe(0);
    void eq;
  });
});
