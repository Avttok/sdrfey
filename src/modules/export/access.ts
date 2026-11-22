import { EX_DATASETS, type ExDataset, type ExDatasetKey } from "@/config/export-spec";

/** Bases que a pessoa pode baixar: o Adm vê todas; os outros, só as que o Adm liberou (Permissões › Exportar). */
export function allowedDatasets(user: { isAdmin: boolean; permissions: Record<string, boolean> }): ExDataset[] {
  return EX_DATASETS.filter((d) => user.isAdmin || user.permissions[`export.${d.key}`]);
}
export const canExport = (user: { isAdmin: boolean; permissions: Record<string, boolean> }, key: ExDatasetKey) => allowedDatasets(user).some((d) => d.key === key);
