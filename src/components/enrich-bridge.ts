import type { DockData } from "@/modules/enrich/daemon-actions";

/**
 * Ponte entre o painel flutuante (que roda a consulta contínua) e a tela do Adm: as duas usam o mesmo estado.
 * O painel avisa a cada novidade (`enrich:state`); quem muda algo avisa de volta (`enrich:set`); quem abre depois pergunta (`enrich:ask`).
 */
export const ENRICH_STATE = "enrich:state";
export const ENRICH_SET = "enrich:set";
export const ENRICH_ASK = "enrich:ask";
export const publishEnrich = (d: DockData) => window.dispatchEvent(new CustomEvent<DockData>(ENRICH_STATE, { detail: d }));
export const setEnrich = (d: DockData) => window.dispatchEvent(new CustomEvent<DockData>(ENRICH_SET, { detail: d }));
export const askEnrich = () => window.dispatchEvent(new Event(ENRICH_ASK));
