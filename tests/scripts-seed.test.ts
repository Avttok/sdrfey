import { describe, expect, it, vi } from "vitest";
vi.mock("@/db", () => ({ db: {}, scripts: {} }));
import { checkTree } from "@/modules/scripts/schema";
import { buildAll } from "@/modules/scripts/seed";

describe("scripts de fábrica", () => {
  it("toda árvore é válida, fechada e termina em um fim", () => {
    for (const { key, nodes, startId } of buildAll()) {
      expect(checkTree(nodes, startId), key).toBeNull();
      for (const n of nodes) if (n.type === "fala") for (const o of n.options) expect(o.to, `${key}/${n.id}`).not.toBeNull();
      expect(nodes.some((n) => n.type === "fim"), key).toBe(true);
    }
  });
});
