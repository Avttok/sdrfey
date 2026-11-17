import { eq, or, type SQL } from "drizzle-orm";
import { users } from "@/db";

/** Contas com "Aparece nas métricas" desligado só aparecem para o admin (e para a própria pessoa). Use em listas de usuários. */
export function visibleUsers(me: { id: number; roles: string[] }): SQL | undefined {
  return me.roles.includes("admin") ? undefined : or(eq(users.inMetrics, true), eq(users.id, me.id));
}
