import { describe, expect, it } from "vitest";
import { brToIso } from "@/components/date-input";

describe("data DD/MM/AAAA", () => {
  it("converte para ISO e recusa datas que não existem", () => {
    expect(brToIso("04/11/2026")).toBe("2026-11-04");
    expect(brToIso("31/02/2026")).toBe("");
    expect(brToIso("4/11/2026")).toBe("");
  });
});
