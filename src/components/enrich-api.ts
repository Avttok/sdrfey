import type { DockData } from "@/modules/enrich/daemon-actions";

/** Chamadas do painel de CNPJ por fetch (fora da fila de ações do servidor, para nunca travar o resto do site). */
async function call<T>(op: "dock" | "start" | "stop" | "tick", scope?: string | number): Promise<T> {
  const res = await fetch("/api/enrich/dock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, scope }), cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}
export const dockApi = () => call<DockData>("dock");
export const startApi = (scope: string | number) => call<DockData>("start", scope);
export const stopApi = () => call<DockData>("stop");
export const tickApi = () => call<DockData & { go: boolean }>("tick");
