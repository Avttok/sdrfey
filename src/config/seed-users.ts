import type { Role } from "./roles";

/**
 * Contas criadas no primeiro deploy. Todas começam com a senha de SEED_INITIAL_PASSWORD
 * e são obrigadas a trocá-la no primeiro acesso. Contas que já existem nunca são alteradas.
 * Depois, o Adm cria e edita contas pela tela de administração.
 */
export const SEED_USERS: { username: string; name: string; roles: Role[] }[] = [
  { username: "ruan.carlos", name: "Ruan", roles: ["user", "manager", "admin"] },
  { username: "suane.oliveira", name: "Suane", roles: ["user"] },
  { username: "jaisson.dias", name: "Jaisson", roles: ["user"] },
  { username: "rejeane.uler", name: "Rejeane", roles: ["user", "manager"] },
  { username: "thais.pacheco", name: "Thais Pacheco", roles: ["seller"] },
  { username: "daniele.silva", name: "Daniele Silva", roles: ["seller"] },
];
