import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CHANNELS, validOutcome } from "@/config/touches";

const user = { id: 0, mustChangePassword: false };
vi.mock("@/modules/auth/guard", () => ({ getCurrentUser: async () => user, requireUser: async () => user, requireAdmin: async () => user }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe("resultados dos contatos", () => {
  it("cada canal tem resultados próprios e números errados são marcados", () => {
    expect(validOutcome("call", "atendeu")).toBe(true);
    expect(validOutcome("whatsapp", "atendeu")).toBe(false);
    expect(CHANNELS.whatsapp.outcomes.map((o) => o.key)).toEqual(["respondeu", "recebida", "ignorada", "sem_whatsapp"]);
    expect(CHANNELS.email.outcomes.find((o) => o.key === "voltou")?.wrong).toBe(true);
  });
});

describe("registro de contatos (banco real)", () => {
  let m: { db: typeof import("@/db"); act: typeof import("@/modules/touches/actions"); q: typeof import("@/modules/touches/queries") };
  let leadId = 0, personId = 0;
  beforeAll(async () => {
    m = { db: await import("@/db"), act: await import("@/modules/touches/actions"), q: await import("@/modules/touches/queries") };
    const [u] = await m.db.db.select({ id: m.db.users.id }).from(m.db.users).limit(1);
    user.id = u.id;
    await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZTOUCH%"));
    const [l] = await m.db.db.insert(m.db.leads).values({ cnpj: "55666777000100", company: "ZZTOUCH Lead", phones: ["47999990001", "47999990002"] }).returning();
    leadId = l.id;
    const [p] = await m.db.db.insert(m.db.leadPeople).values({ leadId, name: "Maria" }).returning();
    personId = p.id;
    await m.db.db.insert(m.db.leadChannels).values([{ leadId, kind: "phone", value: "47999990001", personId }, { leadId, kind: "phone", value: "47999990002" }, { leadId, kind: "email", value: "x@zztouch.com" }]);
  });
  afterAll(async () => { await m.db.db.delete(m.db.leads).where(like(m.db.leads.company, "ZZTOUCH%")); });

  it("ligação: nasce em aberto, resultado grava a pessoa e conclui a tarefa de ligar", async () => {
    await m.db.db.insert(m.db.tasks).values({ userId: user.id, leadId, kind: "ligar", title: "ligar" });
    const s = await m.act.startTouchAction({ leadId, channel: "call", target: "(47) 99999-0001" });
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const open = await m.act.myOpenTouchesAction();
    expect(open.some((o) => o.id === s.id && o.target === "47999990001")).toBe(true);
    const r = await m.act.resolveTouchAction({ id: s.id, outcome: "atendeu", personId, durationSec: 95 });
    expect(r.ok).toBe(true);
    const { rows, stats } = await m.q.leadTouches(leadId);
    expect(rows[0]).toMatchObject({ channel: "call", outcome: "atendeu", personName: "Maria", durationSec: 95 });
    expect(stats.find((x) => x.target === "47999990001")).toMatchObject({ attempts: 1, reached: 1 });
    const [t] = await m.db.db.select().from(m.db.tasks).where(eq(m.db.tasks.leadId, leadId));
    expect(t.doneAt).not.toBeNull();
  });
  it("número errado marca o telefone como inválido; resultado de outro canal é recusado", async () => {
    const s = await m.act.startTouchAction({ leadId, channel: "call", target: "47999990002" });
    if (!s.ok) throw new Error("start");
    expect((await m.act.resolveTouchAction({ id: s.id, outcome: "respondeu" })).ok).toBe(false);
    expect((await m.act.resolveTouchAction({ id: s.id, outcome: "numero_errado" })).ok).toBe(true);
    const [c] = await m.db.db.select().from(m.db.leadChannels).where(eq(m.db.leadChannels.value, "47999990002"));
    expect(c.wrong).toBe(true);
  });
  it("e-mail que voltou marca o e-mail; não atendeu pode criar nova tarefa", async () => {
    const e = await m.act.startTouchAction({ leadId, channel: "email", target: "X@zztouch.com" });
    if (!e.ok) throw new Error("start");
    await m.act.resolveTouchAction({ id: e.id, outcome: "voltou" });
    const [c] = await m.db.db.select().from(m.db.leadChannels).where(eq(m.db.leadChannels.value, "x@zztouch.com"));
    expect(c.wrong).toBe(true);
    const w = await m.act.startTouchAction({ leadId, channel: "whatsapp", target: "47999990001" });
    if (!w.ok) throw new Error("start");
    await m.act.resolveTouchAction({ id: w.id, outcome: "ignorada", retryDays: 1 });
    const tasks = await m.db.db.select().from(m.db.tasks).where(eq(m.db.tasks.leadId, leadId));
    expect(tasks.some((t) => t.kind === "whatsapp" && !t.doneAt)).toBe(true);
    const calls = await m.q.todayCalls(user.id);
    expect(calls.made).toBeGreaterThanOrEqual(2);
  });
});
