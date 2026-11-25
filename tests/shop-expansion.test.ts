import { describe, expect, it } from "vitest";
import { BANNERS } from "@/config/banners";
import { SET_BY_KEY, SETS, SHOP, SHOP_BY_KEY } from "@/config/shop";

function topLevel(css: string): string[] {
  const out: string[] = []; let d = 0, cur = "";
  for (const ch of css) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur.trim()); cur = ""; } else cur += ch; }
  out.push(cur.trim()); return out;
}

describe("loja: expansão", () => {
  it("chaves únicas", () => { expect(new Set(SHOP.map((i) => i.key)).size).toBe(SHOP.length); });
  it("ao menos 10 itens novos por categoria", () => {
    for (const c of ["font", "color", "effect", "bubble", "banner"]) expect(SHOP.filter((i) => i.cat === c).length).toBeGreaterThanOrEqual(10);
  });
  it("5 conjuntos, cada um com um item de cada tipo", () => {
    expect(SETS.length).toBe(5);
    for (const s of SETS) {
      expect(SET_BY_KEY.get(s.key)).toBe(s);
      expect(s.items.map((k) => SHOP_BY_KEY.get(k)?.cat).sort()).toEqual(["banner", "bubble", "color", "effect", "font"]);
    }
  });
  it("banners (padrão e da loja) não têm cor solta dentro de background-image", () => {
    const all = [...BANNERS.map((b) => b.css), ...SHOP.filter((i) => i.cat === "banner").map((i) => i.css)];
    for (const css of all) {
      const bg = (css as unknown as { backgroundImage?: string }).backgroundImage ?? "";
      if (bg) for (const layer of topLevel(bg)) expect(layer).toMatch(/gradient\(|url\(/);
    }
  });
});
