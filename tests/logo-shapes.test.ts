import { describe, expect, it } from "vitest";
import { BOX, FEY, SDR, logoFrame, PACES, rectsPath } from "@/config/logo-shapes";

const bbox = (a: { x: number; y: number; w: number; h: number }[]) => ({ x0: Math.min(...a.map((r) => r.x)), y0: Math.min(...a.map((r) => r.y)), x1: Math.max(...a.map((r) => r.x + r.w)), y1: Math.max(...a.map((r) => r.y + r.h)) });

describe("logo FEY ⇄ SDR", () => {
  it("os dois logos ocupam o mesmo quadrado perfeito", () => {
    for (const s of [FEY, SDR]) { const b = bbox(s); expect(Math.round(b.x0)).toBe(0); expect(Math.round(b.y0)).toBe(0); expect(Math.round(b.x1)).toBe(BOX); expect(Math.round(b.y1)).toBe(BOX); }
  });
  it("começa na FEY, passa pela SDR e fecha o ciclo", () => {
    const { hold, move } = PACES[1];
    expect(logoFrame(0, "morph")).toBe(FEY);
    expect(logoFrame(hold + move + 10, "morph")).toBe(SDR);
    expect(logoFrame(2 * (hold + move), "wave")).toBe(FEY);
  });
  it("durante a troca gera caminho válido e dentro do quadrado", () => {
    for (const k of ["morph", "wave"] as const) for (let t = 1000; t < 3000; t += 137) {
      const f = logoFrame(t, k); expect(rectsPath(f)).toMatch(/^M/);
      const b = bbox(f.filter((r) => r.w * r.h > 0)); expect(b.x0).toBeGreaterThanOrEqual(-1); expect(b.x1).toBeLessThanOrEqual(BOX + 1); expect(b.y0).toBeGreaterThanOrEqual(-1); expect(b.y1).toBeLessThanOrEqual(BOX + 1);
    }
  });
});
