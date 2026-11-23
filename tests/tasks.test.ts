import { describe, expect, it } from "vitest";
import { dueBucket, dueFromDays } from "@/config/tasks";

describe("tarefas: prazos", () => {
  it("dias úteis: sábado e domingo vão para segunda, às 9h de Brasília", () => {
    const sex = new Date("2026-11-20T15:00:00Z");
    const d = dueFromDays(2, sex);
    expect(d.toISOString()).toBe("2026-11-23T12:00:00.000Z");
  });
  it("hoje (0 dias) fica hoje", () => {
    const d = dueFromDays(0, new Date("2026-11-18T15:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2026-11-18");
  });
  it("agrupa por atrasada / hoje / amanhã / sem data", () => {
    const now = new Date("2026-11-18T15:00:00Z");
    expect(dueBucket(new Date("2026-11-17T12:00:00Z"), now)).toBe("atrasada");
    expect(dueBucket(new Date("2026-11-18T20:00:00Z"), now)).toBe("hoje");
    expect(dueBucket(new Date("2026-11-19T12:00:00Z"), now)).toBe("amanha");
    expect(dueBucket(null, now)).toBe("sem_data");
  });
});
