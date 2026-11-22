/** Consulta contínua de CNPJ: roda em qualquer página até o Adm parar ou ficar offline. DB-free (o navegador também usa). */
export const DAEMON_KEY = "enrich_daemon";
export const DAEMON_OFFLINE_MIN = 10;
export type DaemonState = { on: boolean; by: number | null; byName: string | null; mine: boolean; scope: string; since: string | null; stoppedWhy: string | null };
