"use server";

import { requirePerm } from "@/modules/auth/guard";
import { getClientHistory, type ClientHistory } from "./history";

/** Histórico completo de um cliente para o aviso de "já está na carteira". */
export async function clientHistoryAction(leadId: number): Promise<ClientHistory | null> {
  await requirePerm("tab.negociacoes");
  return getClientHistory(leadId);
}
