import { getSettings } from "@/modules/settings/get";

/**
 * O roteiro durante a ligação vale quando a chave geral do Adm está ligada (Ligações) e a pessoa tem a função
 * (Permissões: por pessoa ou por cargo). A chave geral desliga para todos, inclusive o Adm.
 */
export async function roteiroEnabled(user: { isAdmin: boolean; permissions: Record<string, boolean> }): Promise<boolean> {
  const s = await getSettings();
  return s.roteiro_on === 1 && (user.isAdmin || !!user.permissions["fn.roteiro"]);
}
