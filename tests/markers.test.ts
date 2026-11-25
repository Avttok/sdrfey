import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { MARKERS, markerFromQuery } from "@/config/markers";
import { listLeads, parseFilters } from "@/modules/leads/list";
import { markerCond } from "@/modules/leads/markers";

describe("marcadores dos leads", () => {
  it("entende buscas por marcador", () => {
    expect(markerFromQuery("Site")).toEqual({ has: ["site"], not: [] });
    expect(markerFromQuery("redes sociais")).toEqual({ has: ["redes"], not: [] });
    expect(markerFromQuery("site e instagram")).toEqual({ has: ["site", "instagram"], not: [] });
    expect(markerFromQuery("sem celular")).toEqual({ has: [], not: ["celular"] });
    expect(markerFromQuery("site, sem e-mail")).toEqual({ has: ["site"], not: ["email"] });
    expect(markerFromQuery("metalurgica silva")).toBeNull();
    expect(markerFromQuery("site da silva")).toBeNull();
  });
  it("todo marcador tem condição SQL que executa", async () => {
    expect(new Set(MARKERS.map((m) => m.key)).size).toBe(MARKERS.length);
    for (const m of MARKERS) {
      expect(markerCond(m.key), m.key).not.toBeNull();
      await db.execute(sql`select 1 from leads where ${markerCond(m.key)!} limit 1`);
    }
  });
  it("filtra pela lista de leads, com e sem o marcador, e devolve os marcadores", async () => {
    const com = await listLeads(parseFilters({ tag: "marcador:site" }));
    const sem = await listLeads(parseFilters({ sem: "site" }));
    for (const l of com.rows) expect(l.markers).toContain("site");
    for (const l of sem.rows) expect(l.markers).not.toContain("site");
    expect(parseFilters({ tag: "marcador:site", sem: ["x;drop", "celular"] }).sem).toEqual(["celular"]);
  });
});
