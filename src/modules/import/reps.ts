import { sql } from "drizzle-orm";
import { cities, db, reps, type Db } from "@/db";
import { logAudit } from "@/modules/audit/log";
import { REP_COLUMNS, mapColumns, type RepField } from "./columns";
import { cleanText, stripAccents } from "./normalize";

export type RepDraft = {
  sapCode: string;
  esc: number | null;
  managerName: string | null;
  team: string | null;
  cnpj: string | null;
  address: string | null;
  cep: string | null;
  city: string | null;
  uf: string | null;
  repName: string | null;
  active: boolean;
};

export const cityKey = (name: string) => stripAccents(name).toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Erros de digitação conhecidos nas planilhas: "cidade|UF" digitada → nome correto.
 * Para corrigir outro caso no futuro, é só acrescentar uma linha aqui.
 */
const CITY_FIXES: Record<string, string> = {
  "goiana|GO": "goiania",
};

/** Chave de busca da cidade no cadastro do IBGE, já com as correções acima. */
export function cityLookupKey(city: string, uf: string): string {
  const key = cityKey(city);
  return `${CITY_FIXES[`${key}|${uf}`] ?? key}|${uf}`;
}

export function parseRepRows(headers: string[], rows: Record<string, string>[]) {
  const cols = mapColumns<RepField>(headers, REP_COLUMNS);
  const warnings: string[] = [];
  const drafts: RepDraft[] = [];
  if (!cols.sapCode) return { drafts, warnings: ["Coluna COD SAP não encontrada no arquivo."] };

  const get = (row: Record<string, string>, f: RepField) => (cols[f] ? cleanText(row[cols[f]!]) : null);

  rows.forEach((row, i) => {
    const sapCode = get(row, "sapCode");
    if (!sapCode) {
      warnings.push(`Linha ${i + 2}: sem COD SAP, ignorada.`);
      return;
    }
    const esc = Number(get(row, "esc"));
    drafts.push({
      sapCode,
      esc: Number.isFinite(esc) && get(row, "esc") ? esc : null,
      managerName: get(row, "manager"),
      team: get(row, "team"),
      cnpj: get(row, "cnpj"),
      address: get(row, "address"),
      cep: get(row, "cep"),
      city: get(row, "city"),
      uf: get(row, "uf")?.toUpperCase() ?? null,
      repName: get(row, "repName"),
      active: !/^(N[AÃ]O|N|0|FALSE|INATIVO)$/i.test(get(row, "active") ?? "SIM"),
    });
  });
  return { drafts, warnings };
}

/** Grava (ou atualiza, pelo código SAP) os representantes e acha as coordenadas pela cidade. */
export async function applyRepDrafts(
  drafts: RepDraft[],
  opts: { importedBy: number | null; sourceName: string },
  database: Db = db,
) {
  return database.transaction(async (tx) => {
    const cityRows = await tx.select().from(cities);
    const coords = new Map(cityRows.map((c) => [`${c.nameNorm}|${c.uf}`, c]));
    let withoutCoords = 0;

    for (const d of drafts) {
      const c = d.city && d.uf ? coords.get(cityLookupKey(d.city, d.uf)) : undefined;
      if (!c) withoutCoords++;
      const values = { ...d, lat: c?.lat ?? null, lon: c?.lon ?? null };
      await tx
        .insert(reps)
        .values(values)
        .onConflictDoUpdate({
          target: reps.sapCode,
          set: {
            esc: values.esc,
            managerName: values.managerName,
            team: values.team,
            cnpj: values.cnpj,
            address: values.address,
            cep: values.cep,
            city: values.city,
            uf: values.uf,
            repName: values.repName,
            active: values.active,
            lat: sql`coalesce(${values.lat}, ${reps.lat})`,
            lon: sql`coalesce(${values.lon}, ${reps.lon})`,
          },
        });
    }
    await logAudit(tx, {
      userId: opts.importedBy,
      entity: "import",
      action: "importou representantes",
      meta: { arquivo: opts.sourceName, total: drafts.length, semCoordenadas: withoutCoords },
    });
    return { total: drafts.length, withoutCoords, citiesLoaded: cityRows.length };
  });
}
