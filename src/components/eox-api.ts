import type { EoxPreview } from "@/modules/eox/consult";
import type { EoxDock } from "@/modules/eox/consult-daemon";

/** Chamadas do painel da EOX por fetch (fora da fila de ações do servidor, para nunca travar o resto do site). */
async function call<T>(op: "dock" | "start" | "stop" | "tick" | "preview", scope?: string, query?: string): Promise<T> {
  const res = await fetch("/api/eox/dock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, scope, query }), cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}
export const eoxDockApi = () => call<EoxDock>("dock");
export const eoxStartApi = (scope: string) => call<EoxDock>("start", scope);
export const eoxStopApi = () => call<EoxDock>("stop");
export const eoxPreviewApi = (query: string) => call<EoxPreview>("preview", undefined, query);
export const eoxTickApi = () => call<EoxDock & { go: boolean }>("tick");

/** Ponte entre o painel flutuante (que roda a consulta) e a tela do Adm: as duas mostram o mesmo estado. */
export const EOX_STATE = "eox:state", EOX_SET = "eox:set", EOX_ASK = "eox:ask", DOCK_OPEN = "dock:open";
export const publishEox = (d: EoxDock) => window.dispatchEvent(new CustomEvent<EoxDock>(EOX_STATE, { detail: d }));
export const setEox = (d: EoxDock) => window.dispatchEvent(new CustomEvent<EoxDock>(EOX_SET, { detail: d }));
export const askEox = () => window.dispatchEvent(new Event(EOX_ASK));
