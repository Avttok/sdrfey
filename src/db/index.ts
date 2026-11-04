import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Uma única conexão por instância do servidor.
 * `prepare: false` é necessário para o endereço "pooled" do Neon.
 * A conexão só abre de fato na primeira consulta, então o build não precisa do banco.
 */
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.__sql ??
  postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/postgres", {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export * from "./schema";
