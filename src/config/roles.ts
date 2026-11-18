/**
 * Cargos do sistema. O Adm é o topo: faz tudo que Gestor e Usuário fazem.
 * Para criar um cargo novo, adicione aqui e use `hasRole()` onde precisar.
 */
export const ROLES = ["user", "seller", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<Role, { label: string; defaultAccent: string; rank: number }> = {
  user: { label: "SDR", defaultAccent: "azul", rank: 1 },
  seller: { label: "Vendas", defaultAccent: "verde", rank: 1 },
  manager: { label: "Gestor", defaultAccent: "amarelo", rank: 2 },
  admin: { label: "Adm", defaultAccent: "vermelho", rank: 3 },
};

/** Cargos que os outros podem ver: o "Adm" só aparece para o próprio Adm (a equipe não vê quem é admin). */
export function publicRoles(roles: readonly Role[], viewerIsAdmin: boolean): Role[] {
  return viewerIsAdmin ? [...roles] : roles.filter((r) => r !== "admin");
}

/** O cargo mais alto da pessoa (define a cor padrão). */
export function topRole(roles: readonly Role[]): Role {
  return [...roles].sort((a, b) => ROLE_META[b].rank - ROLE_META[a].rank)[0] ?? "user";
}

/** Adm tem tudo; Gestor tem Gestor, Usuário e Vendedor; Usuário e Vendedor só o que são. */
export function hasRole(roles: readonly Role[], needed: Role): boolean {
  if (roles.includes(needed)) return true;
  const top = ROLE_META[topRole(roles)].rank;
  return top > 1 && top >= ROLE_META[needed].rank;
}

/** Vendedor puro: não tem nenhum cargo de SDR/gestão. Vê só a visão de vendas. */
export function isSellerOnly(roles: readonly Role[]): boolean {
  return roles.includes("seller") && !roles.some((r) => r !== "seller");
}

/** Tem a parte de SDR (atendimento): qualquer cargo que não seja só Vendedor. Cargos se somam: SDR + Vendedor vê as duas partes. */
export function hasSdrPart(roles: readonly Role[]): boolean {
  return !isSellerOnly(roles);
}

/** Tem a parte de vendas própria (negociações dele). */
export function hasSellerPart(roles: readonly Role[]): boolean {
  return roles.includes("seller");
}
