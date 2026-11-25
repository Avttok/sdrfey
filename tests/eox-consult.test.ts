import { createHash } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EOX_LISTS } from "@/config/eox-lists";
import { mapAccount } from "@/modules/eox/consult-parse";

vi.mock("@/modules/auth/guard", () => ({ requireAdmin: async () => ({ id: 1 }), getCurrentUser: async () => ({ id: 1 }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

/** Cadastro com os nomes internos do perfil real da EOX da Fey (Perfil completo). */
const ACCOUNT = { id: "6x1479422", cnpj: "60.367.615/0001-82", id_erp_original: "121068", id_erp: "60367615000182", accountname: "60.367.615 JOSE GUILHERME MARTINS", nome_fantasia: "JOSE GUILH", phone: "(28) 9934-7314", otherphone: "", otherphone2: "(28) 3522-1000", whatsapp: "(28) 99999-1111", email1: "comerciallg2011@gmail.com", email2: "outro@x.com", email_vendedor: "vendedor@fey.com", accounttype: "Customer", segmento: "DIST. ? FERRAGISTA", bill_city: "CACHOEIRO DE ITAPEMIRIM", bill_state: "ES", bill_street: "RUA DAS FLORES", bill_numero: "120", bill_complemento: "SALA 2", bill_code: "29300-000", bill_bairro: "CENTRO", inscricao_estadual: "072145897", website: "www.exemplo.com.br", facebook: "", data_fundacao: "0000-00-00", data_ultimo_faturamento: "2026-02-27", ticket_medio: "3559.11000000", discagens_bloqueadas: "1", cf_9: "(28) 98765-4321" };

describe("mapAccount (puro)", () => {
  const labels = new Map<string, string>();
  const f = mapAccount(ACCOUNT, labels, [{ firstname: "Ana", lastname: "Lima", title: "Compradora", mobile: "(28) 98888-2222", email: "ana@x.com" }], [{ value: "2899347314", type: "Phone" }, { value: "28988882222", type: "WhatsApp" }]);
  it("pega só os telefones e e-mails do cliente, com o tipo quando o campo diz", () => {
    expect(f.phones).toEqual(expect.arrayContaining(["28999347314", "28999991111", "2835221000", "28988882222"]));
    expect(f.phones).not.toContain("28987654321"); // campo extra só entra se o Adm indicar
    expect(f.emails).toEqual(["comerciallg2011@gmail.com", "outro@x.com"]); // sem o e-mail do vendedor
    expect(f.phoneKinds["28999991111"]).toBe("WhatsApp");
    expect(f.phoneKinds["28988882222"]).toBe("WhatsApp");
    expect(f.phoneKinds["28999347314"]).toBe("Fixo");
    expect(mapAccount(ACCOUNT, labels, [], [], { extraPhoneFields: "cf_9", extraEmailFields: "" }).phones).toContain("28987654321");
  });
  it("monta endereço, IE, site e o ID EOX pelos nomes reais", () => {
    expect(f).toMatchObject({ address: "RUA DAS FLORES, 120, SALA 2", zip: "29300-000", neighborhood: "CENTRO", city: "CACHOEIRO DE ITAPEMIRIM", uf: "ES", stateReg: "072145897", site: "www.exemplo.com.br", code: "121068", facebook: null });
  });
  it("retrato com rótulos da tela, datas, dinheiro e sim/não como a EOX mostra", () => {
    expect(f.info).toMatchObject({ "Nome Fantasia": "JOSE GUILH", Tipo: "Customer", "Data Último Faturamento": "27-02-2026", "Ticket Médio": "3.559,11", "Discagens bloqueadas": "Sim", "Inscrição Estadual": "072145897" });
    expect(f.info["Data Fundação"]).toBeUndefined();
    expect(f.info["Email do Vendedor"]).toBeUndefined();
  });
  it("traz as pessoas com cargo, telefone e e-mail", () => {
    expect(f.people).toEqual([{ name: "Ana Lima", title: "Compradora", phones: ["28988882222"], emails: ["ana@x.com"] }]);
    expect(f.contactName).toBe("Ana Lima");
  });
});

const fakeFetch = (async (url: string, init?: RequestInit) => {
  const u = new URL(url);
  const op = u.searchParams.get("operation") ?? new URLSearchParams(String(init?.body ?? "")).get("operation");
  const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
  if (op === "getchallenge") return ok({ token: "TOK" });
  if (op === "login") return ok({ sessionName: "S" });
  if (op === "describe") {
    const el = u.searchParams.get("elementType");
    return ok({ fields: el === "Telefones" ? [{ name: "numero", label: "Número", type: { name: "string" } }, { name: "tipo_telefone", label: "Tipo Telefone", type: { name: "picklist" } }, { name: "parent_id", label: "Empresa", type: { name: "reference", refersTo: ["Accounts"] } }] : [] });
  }
  const q = u.searchParams.get("query") ?? "";
  if (/FROM Accounts/.test(q)) return ok(/cnpj = '60367615000182'/.test(q) ? [ACCOUNT] : []);
  if (/FROM Contacts/.test(q)) return ok([{ firstname: "Ana", lastname: "Lima", title: "Compradora", mobile: "(28) 98888-2222", email: "ana@x.com" }]);
  if (/FROM Telefones/.test(q)) return ok([{ numero: "2899347314", tipo_telefone: "Phone" }, { numero: "28988882222", tipo_telefone: "WhatsApp" }]);
  return ok([]);
}) as unknown as typeof fetch;

describe("Consulta EOX de um lead (banco real, EOX de mentira)", () => {
  let m: { db: typeof import("@/db"); c: typeof import("@/modules/eox/consult"); cfg: typeof import("@/modules/eox/config"); settings: typeof import("@/modules/settings/get") };
  beforeAll(async () => {
    m = { db: await import("@/db"), c: await import("@/modules/eox/consult"), cfg: await import("@/modules/eox/config"), settings: await import("@/modules/settings/get") };
    vi.stubGlobal("fetch", fakeFetch);
    await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZCONS%"));
    await m.db.db.insert(m.db.settings).values({ key: m.cfg.EOX_KEY, value: m.cfg.parseEox({ on: true, baseUrl: "fey.exemplo.com.br", username: "robo", accessKey: "segredo", cnpjField: "cnpj", codeField: "id_erp_original" }) }).onConflictDoUpdate({ target: m.db.settings.key, set: { value: m.cfg.parseEox({ on: true, baseUrl: "fey.exemplo.com.br", username: "robo", accessKey: "segredo", cnpjField: "cnpj", codeField: "id_erp_original" }) } });
    m.settings.invalidateSettings();
    await m.db.db.insert(m.db.leads).values([{ cnpj: "60367615000182", company: "ZZCONS achado", city: "Minha Cidade" }, { cnpj: "11111111000191", company: "ZZCONS desconhecido" }]);
  });
  afterAll(async () => { vi.unstubAllGlobals(); await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZCONS%")); await m.db.db.delete(m.db.settings).where(eq(m.db.settings.key, m.cfg.EOX_KEY)); m.settings.invalidateSettings(); });

  it("completa o lead sem trocar o que já existe", async () => {
    const [l] = await m.db.db.select().from(m.db.leads).where(eq(m.db.leads.company, "ZZCONS achado"));
    const r = await m.c.eoxConsultLead(l.id, null, "manual");
    expect(r).toMatchObject({ ok: true, record: "1479422" });
    expect(r.people).toBe(1);
    const [after] = await m.db.db.select().from(m.db.leads).where(eq(m.db.leads.id, l.id));
    expect(after).toMatchObject({ city: "Minha Cidade", uf: "ES", address: "RUA DAS FLORES, 120, SALA 2", zip: "29300-000", contactName: "Ana Lima", eoxId: "1479422", eoxCode: "121068", stateReg: "072145897" });
    expect(after.eoxCheckedAt).not.toBeNull();
    const ch = await m.db.db.select().from(m.db.leadChannels).where(eq(m.db.leadChannels.leadId, l.id));
    expect(ch.find((x) => x.value === "28988882222")).toMatchObject({ origin: "eox", label: "WhatsApp" });
    expect(ch.some((x) => x.kind === "email" && x.value === "ana@x.com")).toBe(true);
    const log = await m.db.db.select().from(m.db.eoxLog).where(eq(m.db.eoxLog.leadId, l.id));
    expect(log[0]).toMatchObject({ ok: true, people: 1 });
  });
  it("a EOX não conhece o lead: falha definitiva e fica estacionado", async () => {
    const [l] = await m.db.db.select().from(m.db.leads).where(eq(m.db.leads.company, "ZZCONS desconhecido"));
    const r = await m.c.eoxConsultLead(l.id, null, "manual");
    expect(r).toMatchObject({ ok: false, permanent: true });
    const [after] = await m.db.db.select().from(m.db.leads).where(eq(m.db.leads.id, l.id));
    expect(after.eoxCheckedAt).toBeNull();
    expect(after.eoxTriedAt!.getTime()).toBeGreaterThan(Date.now());
  });
  it("estatísticas e painel: todas as filas montam o SQL e contam", async () => {
    const b = await import("@/modules/eox/consult-batch");
    const st = await b.eoxStats();
    expect(Object.keys(st.lists).sort()).toEqual(EOX_LISTS.map((l) => l.key).sort());
    expect(st.linked).toBeGreaterThanOrEqual(1);
    expect(st.done).toBeGreaterThanOrEqual(1);
    const dk = await (await import("@/modules/eox/consult-daemon")).eoxDock({ id: 1 });
    expect(dk.rows[0]).toMatchObject({ ok: false });
  });
  it("fila por estado vazia não consulta ninguém; opções são normalizadas", async () => {
    const b = await import("@/modules/eox/consult-batch");
    expect(await b.eoxBatch(10, 5000, null, "uf:ZZ")).toEqual({ tried: 0, ok: 0, failed: 0 });
    const { parseConsult } = await import("@/modules/eox/consult-options");
    expect(parseConsult({ batch: 9999, workers: 0, retryHours: "x", people: false, extraPhoneFields: "cf_1; cf-2 <b>" })).toMatchObject({ batch: 100, workers: 1, retryHours: 6, people: false, phones: true, extraPhoneFields: "cf_1,cf2,b" });
  });
});
