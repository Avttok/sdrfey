import { createHash } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/guard", () => ({ requireAdmin: async () => ({ id: 1 }), getCurrentUser: async () => ({ id: 1 }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const ACCOUNTS = [
  { id: "6x700", cf_850: "11.111.111/0001-91", cf_code: "9001" },
  { id: "6x701", cf_850: "22.222.222/0001-91", cf_code: "9002" },
];
/** EOX de mentira: login por md5 e consultas por código, CNPJ e páginas. */
const fakeFetch = (async (url: string, init?: RequestInit) => {
  const u = new URL(url);
  const op = u.searchParams.get("operation") ?? new URLSearchParams(String(init?.body ?? "")).get("operation");
  const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
  if (op === "getchallenge") return ok({ token: "TOK" });
  if (op === "login") return new URLSearchParams(String(init?.body)).get("accessKey") === createHash("md5").update("TOKsegredo").digest("hex") ? ok({ sessionName: "S" }) : new Response(JSON.stringify({ success: false, error: { message: "chave" } }));
  const q = u.searchParams.get("query") ?? "";
  if (/LIMIT/.test(q)) return ok(ACCOUNTS);
  const code = /cf_code = '(\w+)'/.exec(q)?.[1];
  if (code) return ok(ACCOUNTS.filter((a) => a.cf_code === code).map((a) => ({ id: a.id })));
  const cnpj = /cf_850 = '(\d{14})'/.exec(q)?.[1];
  return ok(ACCOUNTS.filter((a) => a.cf_850.replace(/\D/g, "") === cnpj).map((a) => ({ id: a.id })));
}) as unknown as typeof fetch;

describe("varredura da base na EOX (banco real)", () => {
  let m: { db: typeof import("@/db"); sync: typeof import("@/modules/eox/sync"); cfg: typeof import("@/modules/eox/config"); settings: typeof import("@/modules/settings/get") };
  beforeAll(async () => {
    m = { db: await import("@/db"), sync: await import("@/modules/eox/sync"), cfg: await import("@/modules/eox/config"), settings: await import("@/modules/settings/get") };
    vi.stubGlobal("fetch", fakeFetch);
    await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZSTEP%"));
    await m.db.db.insert(m.db.settings).values({ key: m.cfg.EOX_KEY, value: m.cfg.parseEox({ on: true, baseUrl: "fey.exemplo.com.br", username: "robo", accessKey: "segredo", cnpjField: "cf_850", codeField: "cf_code" }) }).onConflictDoUpdate({ target: m.db.settings.key, set: { value: m.cfg.parseEox({ on: true, baseUrl: "fey.exemplo.com.br", username: "robo", accessKey: "segredo", cnpjField: "cf_850", codeField: "cf_code" }) } });
    m.settings.invalidateSettings();
    await m.db.db.insert(m.db.leads).values([
      { cnpj: "99999999000191", company: "ZZSTEP por código", eoxCode: "9001" },
      { cnpj: "22222222000191", company: "ZZSTEP por cnpj" },
      { cnpj: "33333333000191", company: "ZZSTEP desconhecido" },
    ]);
  });
  afterAll(async () => { vi.unstubAllGlobals(); await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZSTEP%")); await m.db.db.delete(m.db.settings).where(eq(m.db.settings.key, m.cfg.EOX_KEY)); m.settings.invalidateSettings(); });

  it("passo direto liga pelo ID EOX e pelo CNPJ; o desconhecido fica sem", async () => {
    const r = await m.sync.eoxStep("direct", { restart: true, budgetMs: 20_000 });
    expect(r.ok).toBe(true);
    const rows = await m.db.db.select().from(m.db.leads).where(like(m.db.leads.company, "ZZSTEP%"));
    const by = Object.fromEntries(rows.map((x) => [x.company, x.eoxId]));
    expect(by["ZZSTEP por código"]).toBe("700");
    expect(by["ZZSTEP por cnpj"]).toBe("701");
    expect(by["ZZSTEP desconhecido"]).toBeNull();
  });
  it("varredura geral também completa o ID EOX de quem já tem o Código", async () => {
    await m.db.db.update(m.db.leads).set({ eoxId: null, eoxCode: null }).where(like(m.db.leads.company, "ZZSTEP%"));
    const r = await m.sync.eoxStep("scan", { restart: true });
    expect(r).toMatchObject({ ok: true, done: true });
    const [l] = await m.db.db.select().from(m.db.leads).where(eq(m.db.leads.company, "ZZSTEP por cnpj"));
    expect(l).toMatchObject({ eoxId: "701", eoxCode: "9002" });
  });
});
