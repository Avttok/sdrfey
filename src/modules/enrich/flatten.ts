/** Transforma a resposta crua de uma consulta em linhas "rótulo: valor", sem nada vazio (null, "", [], {}). */
export type RawRow = { label: string; value: string };

const humanize = (k: string) => { const t = k.replace(/_/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

export function flattenRaw(data: unknown, path: string[] = []): RawRow[] {
  if (data === null || data === undefined) return [];
  if (typeof data === "string") return data.trim() === "" ? [] : [{ label: path.join(" › "), value: data.trim() }];
  if (typeof data === "number") return [{ label: path.join(" › "), value: String(data) }];
  if (typeof data === "boolean") return [{ label: path.join(" › "), value: data ? "Sim" : "Não" }];
  if (Array.isArray(data)) return data.flatMap((item, i) => flattenRaw(item, [...path.slice(0, -1), `${path[path.length - 1] ?? "Item"} ${i + 1}`]));
  if (typeof data === "object") return Object.entries(data as Record<string, unknown>).flatMap(([k, v]) => flattenRaw(v, [...path, humanize(k)]));
  return [];
}
