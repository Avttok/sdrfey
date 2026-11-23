import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ScriptGoal } from "@/config/scripts";

/** Qual categoria de script combina com a situação do lead (função pura: fácil de testar). */
export function goalFor(kind: "prospect" | "inativo" | null | undefined, stage: string | null | undefined, area: "sdr" | "vendas"): ScriptGoal {
  if (stage === "cotacao" || stage === "negociacao") return "retorno"; // já recebeu cotação: ligar para retomar
  if (stage === "novo" || stage === "contato") return "vendas"; // negociação aberta: cotar e fechar
  if (kind === "inativo") return "reativar"; // cadastro parado: retomar o contato
  return area === "vendas" ? "vendas" : "sdr"; // lead novo: prospecção
}

/** Olha o cadastro e a negociação aberta do lead e escolhe a categoria inicial do roteiro. */
export async function suggestGoal(leadId: number, area: "sdr" | "vendas"): Promise<ScriptGoal> {
  const [r] = await db.execute<{ kind: "prospect" | "inativo"; stage: string | null }>(sql`
    select l.kind, (select d.stage from deals d where d.lead_id = l.id and d.stage not in ('ganho','perdido') and not d.is_test order by d.id desc limit 1) as stage
    from leads l where l.id = ${leadId}`);
  return goalFor(r?.kind, r?.stage, area);
}
