import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isBlocked, parseEoxSheets } from "@/modules/eox/planilha";

vi.mock("@/modules/auth/guard", () => ({ requireAdmin: async () => ({ id: 1 }), requireUser: async () => ({ id: 1 }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const H_EMP = ["IdEOX", "CNPJ", "EMPRESA", "Telefone", "Email", "Tipo", "Código Vendedor", "Discagens bloqueadas", "Motivo bloqueio", "Endereço Faturamento", "Número Faturamento", "Cidade Faturamento", "Estado Faturamento", "CEP Faturamento"];
const emp = (o: Record<string, string>) => Object.fromEntries(H_EMP.map((h) => [h, o[h] ?? ""]));
const H_CON = ["idEmpresa", "Nome Empresa", "Nome", "Cargo", "Celular", "Email"];
const con = (o: Record<string, string>) => Object.fromEntries(H_CON.map((h) => [h, o[h] ?? ""]));

const empresas = { headers: H_EMP, rows: [
  emp({ IdEOX: "900001", CNPJ: "11.222.333/0001-81", EMPRESA: "ZZEIMP Alfa Ltda", Telefone: "(47) 99999-1111", Email: "A@x.com", Tipo: "Customer", "Código Vendedor": "3571", "Discagens bloqueadas": "Sim", "Motivo bloqueio": "Telefone Não Existe", "Endereço Faturamento": "Rua A", "Número Faturamento": "10", "Cidade Faturamento": "Joinville", "Estado Faturamento": "SC", "CEP Faturamento": "89200-000" }),
  emp({ IdEOX: "900002", CNPJ: "44.555.666/0001-43", EMPRESA: "ZZEIMP Beta", Tipo: "Prospect", "Discagens bloqueadas": "Não" }),
  emp({ CNPJ: "lixo", EMPRESA: "sem cnpj" }),
] };
const contatos = { headers: H_CON, rows: [
  con({ idEmpresa: "1308074", "Nome Empresa": "ZZEIMP Alfa Ltda", Nome: "Maria", Cargo: "Compras", Celular: "(47) 98888-2222", Email: "maria@x.com" }),
  con({ idEmpresa: "1308074", "Nome Empresa": "zzeimp alfa ltda", Nome: "João", Cargo: "Dono" }),
  con({ idEmpresa: "5", "Nome Empresa": "Empresa que não existe", Nome: "Fulano" }),
] };

describe("planilhas da EOX", () => {
  it("lê Empresas, liga os Contatos pelo nome e acha o Registro", () => {
    const p = parseEoxSheets(empresas, contatos);
    expect(p.companies).toHaveLength(2);
    expect(p.withoutCnpj).toBe(1);
    const a = p.companies[0];
    expect(a.code).toBe("900001"); expect(a.recordId).toBe("1308074");
    expect(a.cnpj).toBe("11222333000181"); expect(a.phones).toEqual(["47999991111"]); expect(a.email).toBe("a@x.com");
    expect(a.address).toBe("Rua A, 10"); expect(a.zip).toBe("89200000"); expect(a.isCustomer).toBe(true);
    expect(a.people.map((x) => x.name)).toEqual(["Maria", "João"]);
    expect(a.people[0].phones).toEqual(["47988882222"]);
    expect(isBlocked(a.info)).toBe(true); expect(a.info["Motivo bloqueio"]).toBe("Telefone Não Existe");
    expect(isBlocked(p.companies[1].info)).toBe(false);
    expect(p.companies[1].recordId).toBeNull();
  });
  it("nome repetido nas Empresas não recebe Registro (ambíguo)", () => {
    const dup = { headers: H_EMP, rows: [...empresas.rows.slice(0, 1), emp({ IdEOX: "900009", CNPJ: "99.888.777/0001-04", EMPRESA: "zzeimp alfa ltda" })] };
    const p = parseEoxSheets(dup, contatos);
    expect(p.companies.every((c) => c.recordId === null)).toBe(true); expect(p.ambiguous).toBe(1);
  });
});

describe("gravação em lote", () => {
  let m: { db: typeof import("@/db"); act: typeof import("@/modules/eox/import") };
  beforeAll(async () => {
    m = { db: await import("@/db"), act: await import("@/modules/eox/import") };
    await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZEIMP%"));
    await m.db.db.insert(m.db.leads).values({ cnpj: "11222333000181", company: "ZZEIMP Alfa", phones: ["47911110000"], address: "Rua Antiga" });
  });
  afterAll(async () => { await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZEIMP%")); });
  it("prévia não grava; gravar completa só o vazio e guarda o retrato", async () => {
    const { companies } = parseEoxSheets(empresas, contatos);
    const prev = await m.act.importEoxBatchAction(companies, false, false, "t");
    expect(prev).toMatchObject({ ok: true, found: 1, missing: 1, codes: 1, ids: 1, people: 2 });
    const [before] = await m.db.db.select().from(m.db.leads).where(like(m.db.leads.company, "ZZEIMP%"));
    expect(before.eoxCode).toBeNull();

    const r = await m.act.importEoxBatchAction(companies, true, false, "t");
    expect(r.ok).toBe(true);
    const [l] = await m.db.db.select().from(m.db.leads).where(like(m.db.leads.company, "ZZEIMP%"));
    expect(l.eoxCode).toBe("900001"); expect(l.eoxId).toBe("1308074");
    expect(l.address).toBe("Rua Antiga"); expect(l.city).toBe("Joinville");
    expect(l.phones.sort()).toEqual(["47911110000", "47999991111"]);
    expect(l.eoxInfo?.["Código Vendedor"]).toBe("3571"); expect(l.eoxSyncedAt).not.toBeNull();
    const people = await m.db.db.select().from(m.db.leadPeople).where((await import("drizzle-orm")).eq(m.db.leadPeople.leadId, l.id));
    expect(people.map((x) => x.name).sort()).toEqual(["João", "Maria"]);
    // repetir não duplica
    await m.act.importEoxBatchAction(companies, true, false, "t");
    const again = await m.db.db.select().from(m.db.leadPeople).where((await import("drizzle-orm")).eq(m.db.leadPeople.leadId, l.id));
    expect(again).toHaveLength(2);
  });
  it("com 'criar', empresas novas viram leads (Prospect → prospecção)", async () => {
    const { companies } = parseEoxSheets(empresas, contatos);
    const r = await m.act.importEoxBatchAction(companies, true, true, "t");
    expect(r).toMatchObject({ ok: true, created: 1 });
    const [b] = await m.db.db.select().from(m.db.leads).where(like(m.db.leads.company, "ZZEIMP Beta"));
    expect(b.kind).toBe("prospect"); expect(b.eoxCode).toBe("900002");
  });
});
