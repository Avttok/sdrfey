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
  it("liga por CNPJ (com ou sem máscara) e por Código EOX, sem trocar Id existente", async () => {
    await m.db.db.update(m.db.leads).set({ eoxId: "3" }).where(like(m.db.leads.company, "ZZEOX C"));
    await m.db.db.update(m.db.leads).set({ eoxCode: "117805" }).where(like(m.db.leads.company, "ZZEOX D"));
    const map = new Map([["11222333000181", "1"], ["11222333000262", "2"], ["11222333000343", "9"]]);
    const n = await m.sync.linkLeads(m.db.db, map, new Map([["117805", "4"]]), null);
    expect(n).toBe(3);
    const rows = await m.db.db.select().from(m.db.leads).where(like(m.db.leads.company, "ZZEOX%"));
    const by = Object.fromEntries(rows.map((r) => [r.company, r.eoxId]));
    expect(by).toEqual({ "ZZEOX A": "1", "ZZEOX B": "2", "ZZEOX C": "3", "ZZEOX D": "4" });
    expect(await m.sync.linkLeads(m.db.db, map, new Map([["117805", "4"]]), null)).toBe(0);
    void eq;
  });
});

describe.skipIf(!HAS_DB)("importar Id EOX / Id SF em 'só enriquecer' (banco real)", () => {
  let d: typeof import("@/db"); let ap: typeof import("@/modules/import/leads-apply");
  const mk = (cnpj: string, extra: object) => ({ cnpj, company: "ZZEOXI", sapCode: null, contactName: null, roleTitle: null, phones: [], email: null, notes: null, tags: [], ...extra }) as unknown as import("@/modules/import/leads-parse").LeadDraft;
  beforeAll(async () => {
    d = await import("@/db"); ap = await import("@/modules/import/leads-apply");
    await d.db.delete(d.leads).where(like(d.leads.company, "ZZEOXI%"));
    await d.db.insert(d.leads).values([
      { cnpj: "55000000000191", company: "ZZEOXI 1", isTest: true },
      { cnpj: "55000000000272", company: "ZZEOXI 2", isTest: true, eoxId: "5", sfId: "0015e00000AAAAAAAA" },
    ]);
  });
  afterAll(async () => { await d.db.delete(d.leads).where(like(d.leads.company, "ZZEOXI%")); });
  it("preenche o que falta e não troca o que já existe", async () => {
    const r = await ap.applyLeadDrafts([
      mk("55000000000191", { eoxId: "1293925", eoxCode: "117805", sfId: "0015e00000AbCdEfGH" }),
      mk("55000000000272", { eoxId: "999", sfId: "0015e00000ZZZZZZZZ" }),
      mk("55000000000353", { eoxId: "7" }),
    ], { importedBy: null, sourceName: "teste", mode: "nutrir" });
    expect(r.inserted).toBe(0);
    const rows = await d.db.select().from(d.leads).where(like(d.leads.company, "ZZEOXI%"));
    const by = Object.fromEntries(rows.map((x) => [x.company, x]));
    expect(by["ZZEOXI 1"].eoxId).toBe("1293925");
    expect(by["ZZEOXI 1"].eoxCode).toBe("117805");
    expect(by["ZZEOXI 1"].sfId).toBe("0015e00000AbCdEfGH");
    expect(by["ZZEOXI 2"].eoxId).toBe("5"); expect(by["ZZEOXI 2"].sfId).toBe("0015e00000AAAAAAAA");
  });
});
