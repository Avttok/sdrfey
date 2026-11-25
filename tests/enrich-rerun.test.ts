import { inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/guard", () => ({ requireAdmin: async () => ({ id: 1 }), getCurrentUser: async () => ({ id: 1 }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const T = "88888888000191", P = "77777777000191", OK = "66666666000191";
const calls: Record<string, number> = {};
const good = (cnpj: string) => new Response(JSON.stringify({ cnpj, razao_social: "ZZRERUN empresa", descricao_situacao_cadastral: "Ativa", municipio: "Cidade", uf: "SP", ddd_telefone_1: "1133334444" }));
/** APIs de mentira: o CNPJ T cai 2 vezes (limite) e depois responde; o P não existe (404); o OK responde de primeira. */
const fakeFetch = (async (url: string) => {
  const u = String(url); const cnpj = /(\d{14})/.exec(u)?.[1] ?? "";
  if (!/brasilapi|minhareceita|receitaws|opencnpj/.test(u)) return new Response("<html></html>", { status: 404 });
  if (/opencnpj/.test(u)) return new Response("{}", { status: 404 });
  calls[cnpj] = (calls[cnpj] ?? 0) + 1;
  if (cnpj === P) return new Response("{}", { status: 404 });
  if (cnpj === T && calls[cnpj] <= 2) return new Response("{}", { status: 503 });
  return good(cnpj);
}) as unknown as typeof fetch;

describe("consulta de CNPJ: nova rodada dos que falharam", () => {
  let parked: number[] = [];
  let m: { db: typeof import("@/db"); batch: typeof import("@/modules/enrich/batch") };
  beforeAll(async () => {
    m = { db: await import("@/db"), batch: await import("@/modules/enrich/batch") };
    vi.stubGlobal("fetch", fakeFetch);
    await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZRERUN%"));
    // deixa de lado os outros leads pendentes do banco de teste para o lote pegar só os nossos
    parked = [...(await m.db.db.execute<{ id: number }>(sql`update leads set enrich_tried_at = now() where enriched_at is null and enrich_tried_at is null returning id`))].map((x) => x.id);
    await m.db.db.insert(m.db.leads).values([{ cnpj: T, company: "ZZRERUN transitório" }, { cnpj: P, company: "ZZRERUN inexistente" }, { cnpj: OK, company: "ZZRERUN normal" }]);
  });
  afterAll(async () => { vi.unstubAllGlobals(); if (parked.length) await m.db.db.execute(sql`update leads set enrich_tried_at = null where enriched_at is null and id in (${sql.join(parked.map((i) => sql`${i}`), sql`, `)})`); await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZRERUN%")); });

  it("recupera o que caiu por limite e estaciona o que não existe", async () => {
    const r = await m.batch.enrichBatch(100, 40_000, 1, "lote", "unworked");
    const rows = await m.db.db.select().from(m.db.leads).where(inArray(m.db.leads.cnpj, [T, P, OK]));
    const by = Object.fromEntries(rows.map((x) => [x.cnpj, x]));
    expect(by[OK].enrichedAt).not.toBeNull();
    expect(by[T].enrichedAt).not.toBeNull(); // falhou duas vezes e foi pego na nova rodada
    expect(by[P].enrichedAt).toBeNull();
    expect(by[P].enrichTriedAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000); // parado por 7 dias
    expect(r.rerun?.saved).toBeGreaterThanOrEqual(1);
    expect(r.rerun?.parked).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
