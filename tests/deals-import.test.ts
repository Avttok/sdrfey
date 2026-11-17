import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { parseDealRows, moneyToCents, isoDate } from "@/modules/import/deals-parse";

const H = ["CNPJ", "EMPRESA", "ETAPA", "N COTACAO", "VALOR COTACAO", "N PEDIDO", "DATA FECHADA", "VALOR FECHADO"];
const A = "11.222.333/0001-81", B = "11.444.777/0001-61";
const rows = [
  { CNPJ: A, EMPRESA: "ZZIMP A", ETAPA: "cotação", "N COTACAO": "9001", "VALOR COTACAO": "1.000,50", "N PEDIDO": "", "DATA FECHADA": "", "VALOR FECHADO": "" },
  { CNPJ: A, EMPRESA: "ZZIMP A", ETAPA: "ganho", "N COTACAO": "8001", "VALOR COTACAO": "", "N PEDIDO": "P1", "DATA FECHADA": "10/09/2026", "VALOR FECHADO": "500,00" },
  { CNPJ: A, EMPRESA: "ZZIMP A", ETAPA: "cotação", "N COTACAO": "9002", "VALOR COTACAO": "2,00", "N PEDIDO": "", "DATA FECHADA": "", "VALOR FECHADO": "" }, // 2ª aberta do mesmo CNPJ
  { CNPJ: B, EMPRESA: "ZZIMP B", ETAPA: "inexistente", "N COTACAO": "", "VALOR COTACAO": "", "N PEDIDO": "", "DATA FECHADA": "", "VALOR FECHADO": "" },
  { CNPJ: "123", EMPRESA: "ruim", ETAPA: "", "N COTACAO": "", "VALOR COTACAO": "", "N PEDIDO": "", "DATA FECHADA": "", "VALOR FECHADO": "" },
];

describe("importação de negociações do vendedor", () => {
  it("lê valores e datas brasileiros", () => {
    expect(moneyToCents("R$ 10.127,44")).toBe(1012744);
    expect(moneyToCents("1234.5")).toBe(123450);
    expect(isoDate("16/10/2026")).toBe("2026-10-16");
  });
  it("rejeita o inválido e não repete aberta do mesmo CNPJ", () => {
    const { drafts, report } = parseDealRows(H, rows);
    expect(drafts.map((d) => d.stage)).toEqual(["cotacao", "ganho"]);
    expect(report.duplicatesInFile).toBe(1);
    expect(report.rejected.length).toBe(2);
    expect(drafts[1].closedCents).toBe(50000);
  });
  it("exige a coluna CNPJ", () => expect(parseDealRows(["EMPRESA"], []).report.missingColumns).toEqual(["CNPJ"]));
});

describe.skipIf(!process.env.DATABASE_URL)("importar duas vezes nunca duplica (banco real)", () => {
  afterAll(async () => {
    const { db, leads } = await import("@/db");
    await db.delete(leads).where(inArray(leads.cnpj, ["11222333000181"]));
    await db.$client.end();
  });
  it("segunda importação do mesmo arquivo cria zero", async () => {
    const { db, users } = await import("@/db");
    const { applyDealImport, planDealImport } = await import("@/modules/import/deals-apply");
    const [u] = await db.select({ id: users.id }).from(users).limit(1);
    const { drafts } = parseDealRows(H, rows.slice(0, 2));
    const p1 = await planDealImport(drafts, u.id);
    expect(p1.create.length).toBe(2);
    const r1 = await applyDealImport(p1, { sellerId: u.id, userId: u.id, fileName: "t.csv" });
    expect(r1.created).toBe(2);
    const p2 = await planDealImport(drafts, u.id);
    expect(p2.create.length).toBe(0);
    expect(p2.skipped.length).toBe(2);
  });
});
