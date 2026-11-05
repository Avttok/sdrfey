import { and, eq, sql } from "drizzle-orm";
import { cities, db, reps } from "@/db";
import { cityLookupKey } from "@/modules/import/reps";

export type NearestRep = { id: number; sapCode: string; esc: number | null; cnpj: string | null; cep: string | null; repName: string | null; managerName: string | null; team: string | null; city: string | null; uf: string | null; address: string | null; km: number };

/** Representante ativo mais próximo da cidade do lead (distância em linha reta, pelas coordenadas do IBGE). */
export async function nearestRep(city: string | null, uf: string | null): Promise<NearestRep | null> {
  if (!city || !uf) return null;
  const key = cityLookupKey(city, uf.toUpperCase());
  const [name, state] = key.split("|");
  const [c] = await db.select({ lat: cities.lat, lon: cities.lon }).from(cities).where(and(eq(cities.nameNorm, name), eq(cities.uf, state))).limit(1);
  if (!c) return null;
  const dist = sql<number>`6371 * 2 * asin(sqrt(power(sin(radians(${reps.lat} - ${c.lat}) / 2), 2) + cos(radians(${c.lat})) * cos(radians(${reps.lat})) * power(sin(radians(${reps.lon} - ${c.lon}) / 2), 2)))`;
  const [r] = await db
    .select({ id: reps.id, sapCode: reps.sapCode, esc: reps.esc, cnpj: reps.cnpj, cep: reps.cep, repName: reps.repName, managerName: reps.managerName, team: reps.team, city: reps.city, uf: reps.uf, address: reps.address, km: dist })
    .from(reps)
    .where(and(eq(reps.active, true), sql`${reps.lat} is not null`))
    .orderBy(dist)
    .limit(1);
  return r ? { ...r, km: Math.round(Number(r.km)) } : null;
}
