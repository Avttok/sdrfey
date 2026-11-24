import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { afterMerge, findSets, pickKeeper, type DupPerson } from "@/config/contact-merge";

const user = { id: 0, mustChangePassword: false };
vi.mock("@/modules/auth/guard", () => ({ getCurrentUser: async () => user, requireUser: async () => user, requireAdmin: async () => user }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const P = (id: number, name: string, o: Partial<DupPerson> = {}): DupPerson => ({ id, name, roleTitle: null, phones: [], emails: [], facts: 0, ...o });

describe("juntar contatos: regras", () => {
  it("com a preferência ligada, fica quem tem telefone ou e-mail", () => {
    const a = P(1, "Carlos Eduardo da Silva", { facts: 5 }); const b = P(2, "Carlos", { phones: ["11999990000"] });
    expect(pickKeeper([a, b], true)).toBe(2);
    expect(pickKeeper([a, b], false)).toBe(1);
  });
  it("empata pelo mais completo e, depois, pelo mais antigo", () => {
    expect(pickKeeper([P(5, "Ana"), P(3, "Ana")], true)).toBe(3);
  });
  it("agrupa por telefone, e-mail e nome; nome parecido pede conferência", () => {
    const sets = findSets([{ leadId: 1, company: "X", people: [P(1, "Ana Paula", { phones: ["1"] }), P(2, "Paula", { phones: ["1"] }), P(3, "Carlos"), P(4, "Carlos Silva"), P(5, "José")] }]);
    expect(sets).toHaveLength(2);
    const tel = sets.find((s) => s.people.some((p) => p.id === 1))!; expect(tel.sure).toBe(true); expect(tel.reasons).toEqual(["telefone"]);
    const par = sets.find((s) => s.people.some((p) => p.id === 3))!; expect(par.sure).toBe(false); expect(par.reasons).toEqual(["nome parecido"]);
  });
  it("conta o que sobra depois de juntar sem repetir", () => {
    expect(afterMerge([P(1, "A", { phones: ["1", "2"], facts: 2 }), P(2, "B", { phones: ["2"], emails: ["a@b.com"], facts: 1 })])).toEqual({ phones: 2, emails: 1, facts: 3 });
  });
});

describe("juntar contatos: banco real", async () => {
  const { db, leads, leadPeople, leadChannels, leadFacts } = await import("@/db");
  const c = await import("@/modules/facts/contacts");
  let leadId = 0; const ids: number[] = [];
  beforeAll(async () => {
    const [l] = await db.insert(leads).values({ company: "ZZ JUNTAR TESTE", cnpj: "00000000000191" } as never).returning({ id: leads.id }); leadId = l.id;
    for (const n of ["Carlos Silva", "Carlos", "Marta", "Marta"]) { const [p] = await db.insert(leadPeople).values({ leadId, name: n }).returning({ id: leadPeople.id }); ids.push(p.id); }
    await db.insert(leadChannels).values([{ leadId, personId: ids[1], kind: "phone", value: "11999990000", origin: "import" }, { leadId, personId: ids[2], kind: "email", value: "marta@x.com", origin: "import" }]);
    await db.insert(leadFacts).values([{ leadId, personId: ids[0], key: "aplicacao", value: "x", current: true }, { leadId, personId: ids[1], key: "aplicacao", value: "y", current: true }] as never);
  });
  afterAll(async () => { await db.delete(leads).where(like(leads.company, "ZZ JUNTAR%")); });
  it("a lista traz telefones e dados de cada pessoa e marca quem tem certeza", async () => {
    const sets = (await c.findDuplicateSetsAction()).filter((s) => s.leadId === leadId);
    expect(sets).toHaveLength(2);
    const carlos = sets.find((s) => s.people.some((p) => p.id === ids[0]))!; expect(carlos.sure).toBe(false);
    expect(carlos.people.find((p) => p.id === ids[1])!.phones).toEqual(["11999990000"]);
    expect(pickKeeper(carlos.people, true)).toBe(ids[1]);
  });
  it("junta o conjunto sem perder telefone e fica com o nome mais completo", async () => {
    const r = await c.mergeSetAction(ids[1], [ids[0]]);
    expect(r.ok).toBe(true);
    const [p] = await db.select().from(leadPeople).where(eq(leadPeople.id, ids[1]));
    expect(p.name).toBe("Carlos Silva");
    const ch = await db.select().from(leadChannels).where(eq(leadChannels.personId, ids[1])); expect(ch).toHaveLength(1);
    const f = await db.select().from(leadFacts).where(eq(leadFacts.personId, ids[1])); expect(f).toHaveLength(1);
    expect((await db.select().from(leadPeople).where(eq(leadPeople.id, ids[0])))).toHaveLength(0);
  });
  it("juntar de novo um contato que já foi juntado avisa e não quebra", async () => {
    const r = await c.mergeSetAction(ids[1], [ids[0]]);
    expect(r.ok).toBe(false); expect(r.message).toMatch(/já não existe/);
  });
  it("junta de uma vez os que têm certeza (nome igual)", async () => {
    const r = await c.mergeSureSetsAction(true);
    expect(r.ok).toBe(true);
    const left = await db.select().from(leadPeople).where(eq(leadPeople.leadId, leadId)); expect(left).toHaveLength(2);
    expect((await db.select().from(leadChannels).where(eq(leadChannels.leadId, leadId)))).toHaveLength(2);
  });
});
