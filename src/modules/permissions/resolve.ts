import { PERMISSIONS, type PermissionMap, type RoleOverrides } from "@/config/permissions";
import type { Role } from "@/config/roles";

/**
 * Calcula o que a pessoa pode. Ordem de decisão:
 * Adm → tudo; ajuste individual → ajuste do cargo feito pelo Adm → padrão do sistema.
 * Quem tem vários cargos recebe o que qualquer um deles libera (a menos que haja ajuste individual).
 */
export function resolvePermissions(roles: readonly Role[], personal: PermissionMap = {}, byRole: RoleOverrides = {}): PermissionMap {
  const out: PermissionMap = {};
  const isAdmin = roles.includes("admin");
  for (const p of PERMISSIONS) {
    if (isAdmin) { out[p.key] = true; continue; }
    if (p.key in personal) { out[p.key] = !!personal[p.key]; continue; }
    out[p.key] = roles.some((r) => (byRole[r] && p.key in byRole[r]! ? !!byRole[r]![p.key] : p.defaults.includes(r)));
  }
  return out;
}
