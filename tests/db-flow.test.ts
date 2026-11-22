import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("sorteio e atendimento (banco real)", () => {
  let ids: number[] = [];
  let u1 = 0, u2 = 0;
  let m: Awaited<ReturnType<typeof load>>;
  const load = async () => ({
    db: await import("@/db"),
    sorter: await import("@/modules/leads/sorter"),
    attend: await import("@/modules/leads/attend"),
    tags: await import("@/modules/tags/apply"),
  });

  beforeAll(async () => {
    m = await load();
    const { db, leads, users } = m.db;
    const us = await db.select({ id: users.id }).from(users).limit(2);
    [u1, u2] = [us[0].id, us[1].id];
    await db.update(leads).set({ lockedBy: null, lockedAt: null }).where(like(leads.company, "ZZTESTE%"));
    await db.delete(leads).where(like(leads.company, "ZZTESTE%"));
    const rows = await db
      .insert(leads)
      .values(Array.from({ length: 6 }, (_, i) => ({ cnpj: `9999999900${String(i).padStart(4, "0")}`, company: `ZZTESTE ${i}`, isTest: true })))
      .returning({ id: leads.id });
    ids = rows.map((r) => r.id);
    // cada teste começa sem lead preso
    await db.update(leads).set({ lockedBy: null, lockedAt: null }).where(inArray(leads.lockedBy, [u1, u2]));
  });

  afterAll(async () => {
    const { db, leads, auditLog } = m.db;
    await db.delete(auditLog).where(inArray(auditLog.leadId, ids));
    await db.delete(leads).where(like(leads.company, "ZZTESTE%"));
    await m.db.sql.end();
  });

  it("duas pessoas sorteando ao mesmo tempo nunca recebem o mesmo lead", async () => {
    const got = await Promise.all([m.sorter.claimNext(u1, { test: true }), m.sorter.claimNext(u2, { test: true })]);
    expect(got[0]).not.toBeNull();
    expect(got[1]).not.toBeNull();
    expect(got[0]).not.toBe(got[1]);
    // pedir de novo devolve o mesmo lead (ainda está em mãos)
    expect(await m.sorter.claimNext(u1, { test: true })).toBe(got[0]);
  });

  it("não deixa atender um lead que está com outra pessoa", async () => {
    const [mine2] = await m.db.db.select({ id: m.db.leads.id }).from(m.db.leads).where(eq(m.db.leads.lockedBy, u2));
    await expect(m.sorter.attendLead(u1, mine2.id)).rejects.toThrow(/em atendimento/);
  });

  it("pular esconde o lead só para quem pulou", async () => {
    const [a] = await m.db.db.select({ id: m.db.leads.id }).from(m.db.leads).where(eq(m.db.leads.lockedBy, u1));
    await m.sorter.skipLead(u1, a.id);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const n = await m.sorter.claimNext(u1, { test: true });
      if (n) { seen.push(n); await m.sorter.releaseLead(u1, n); }
    }
    expect(seen).not.toContain(a.id);
  });

  it("salvar atendimento: tags, meta, observação, responsável e histórico", async () => {
    const id = (await m.sorter.claimNext(u1, { test: true }))!;
    await expect(m.attend.saveAttendance(u1, { leadId: id, channels: [], situations: [] })).rejects.toThrow(/meio de contato/);
    await m.attend.saveAttendance(u1, { leadId: id, channels: ["whatsapp", "ligacao"], temperature: "quente", situations: ["conversando"], note: "Pediu retorno", visitCode: "v-12345", visitLink: "https://fey.my.salesforce.com/v-12345", visitDate: "2026-12-01" });
    const { db, leads, auditLog, leadTags, tags } = m.db;
    const [l] = await db.select().from(leads).where(eq(leads.id, id));
    expect(l.lockedBy).toBeNull();
    expect(l.ownerId).toBe(u1);
    expect(l.timesWorked).toBe(1);
    expect(l.notes).toBe("Pediu retorno");
    const keys = (await db.select({ k: tags.key }).from(leadTags).innerJoin(tags, eq(tags.id, leadTags.tagId)).where(eq(leadTags.leadId, id))).map((r) => r.k).sort();
    expect(keys).toEqual(["agendado", "conversando", "ligacao", "qualificado", "quente", "whatsapp"]);
    const log = await db.select().from(auditLog).where(eq(auditLog.leadId, id));
    expect(log.length).toBeGreaterThanOrEqual(8);
    expect(log.every((r) => r.userId === u1)).toBe(true);
    // histórico da pessoa não mostra leads de teste, e leads de outras pessoas não entram no sorteio dela
    expect((await m.sorter.userHistory(u1)).some((h) => h.leadId === id)).toBe(false);
    expect(await m.sorter.claimNext(u2, { test: true })).not.toBe(id);
  });

  it("lead descartado ou com tag bloqueante não é sorteado", async () => {
    const id = (await m.sorter.claimNext(u2, { test: true }))!;
    await m.attend.discardLead(u2, id, "teste");
    const again: number[] = [];
    for (let i = 0; i < 5; i++) { const n = await m.sorter.claimNext(u2, { test: true }); if (n) { again.push(n); await m.sorter.releaseLead(u2, n); } }
    expect(again).not.toContain(id);
  });

  it("exclusividade: trocar a temperatura remove a anterior e registra de → para", async () => {
    const id = ids[ids.length - 1];
    await m.db.db.transaction(async (tx) => {
      await m.tags.setLeadTags(tx, { leadId: id, userId: u1, add: [{ group: "temperatura", key: "frio" }] });
      const r = await m.tags.setLeadTags(tx, { leadId: id, userId: u1, add: [{ group: "temperatura", key: "morno" }] });
      expect(r.removed).toEqual(["Temperatura: Frio"]);
      expect(r.added).toEqual(["Temperatura: Morno"]);
    });
  });
  it("resetar lead apaga tags, observação e interações, mantém os dados e registra", async () => {
    const id = (await m.sorter.claimNext(u2, { test: true }))!;
    await m.attend.saveAttendance(u2, { leadId: id, channels: ["email"], temperature: "frio", situations: [], note: "teste reset" });
    await m.sorter.attendLead(u2, id);
    await m.attend.resetLead(u2, id);
    const { db, leads, leadTags, interactions, auditLog } = m.db;
    const [l] = await db.select().from(leads).where(eq(leads.id, id));
    expect(l.notes).toBeNull();
    expect(l.company).toMatch(/^ZZTESTE/);
    expect(l.timesWorked).toBe(0);
    expect(await db.select().from(leadTags).where(eq(leadTags.leadId, id))).toHaveLength(0);
    expect(await db.select().from(interactions).where(eq(interactions.leadId, id))).toHaveLength(0);
    const log = await db.select().from(auditLog).where(eq(auditLog.leadId, id));
    expect(log.some((r) => r.action === "resetou lead" && r.oldValue === "teste reset")).toBe(true);
  });
});
