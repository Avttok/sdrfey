import { describe, expect, it } from "vitest";
import { effectOf } from "@/config/announcements";

describe("avisos globais", () => {
  it("efeito automático segue o tipo; escolhido vence", () => {
    expect(effectOf("urgente", "auto")).toBe("shake");
    expect(effectOf("atencao", "auto")).toBe("pulse");
    expect(effectOf("aviso", "auto")).toBe("none");
    expect(effectOf("aviso", "shine")).toBe("shine");
  });
});
