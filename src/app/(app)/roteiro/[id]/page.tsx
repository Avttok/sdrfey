import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { guessSegment, type ScriptGoal } from "@/config/scripts";
import { isSellerOnly } from "@/config/roles";
import { requireUser } from "@/modules/auth/guard";
import { getLeadView } from "@/modules/leads/view";
import { leftPortfolio } from "@/modules/deals/portfolio";
import { listScriptsFor } from "@/modules/scripts/list";
import { suggestGoal } from "@/modules/scripts/goal";
import { LeadCall } from "@/components/lead-call";

export const metadata: Metadata = { title: "Roteiro com o lead" };
export const dynamic = "force-dynamic";

const GOALS: ScriptGoal[] = ["sdr", "vendas", "retorno", "fidelizar", "reativar", "visita"];

/** Roteiro de ligação com qualquer lead, fora do shuffler: para acertar cotação, fechar pedido, confirmar visita… */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ area?: string; goal?: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const allowed = me.isAdmin || me.permissions["tab.leads"] || me.permissions["tab.negociacoes"] || me.permissions["tab.visitas"] || me.permissions["tab.tarefas"] || me.permissions["tab.tarefas_vendas"];
  if (!allowed) notFound();
  const lead = await getLeadView(id);
  if (!lead || lead.isTest) notFound();
  // vendedor só enxerga o que é dele ou está no grupo (mesma regra da tela do lead)
  if (isSellerOnly(me.roles)) {
    const r = await db.execute<{ id: number }>(sql`select id from deals where lead_id = ${id} and (seller_id = ${me.id} or seller_id is null) and not ${leftPortfolio(sql`${id}`)} limit 1`);
    if (!r[0]) notFound();
  }
  const area: "sdr" | "vendas" = sp.area === "vendas" || sp.area === "sdr" ? sp.area : isSellerOnly(me.roles) || (me.roles.includes("seller") && !me.roles.includes("user")) ? "vendas" : "sdr";
  const asked = GOALS.find((g) => g === sp.goal);
  const goal = asked ?? (await suggestGoal(id, area));
  const scripts = await listScriptsFor(me.id, goal, guessSegment(lead.tradeName, lead.company, lead.info?.activity));
  const [deal] = await db.execute<{ stage: string; quote_number: string | null; value_cents: number | null; next_action_at: Date | null; next_action_note: string | null }>(sql`
    select stage, quote_number, value_cents, next_action_at, next_action_note from deals where lead_id = ${id} and stage not in ('ganho','perdido') and not is_test order by id desc limit 1`);
  const [visit] = await db.execute<{ visit_date: string | null; rep_name: string | null }>(sql`
    select visit_date::text, rep_name from visits where lead_id = ${id} and canceled_at is null order by id desc limit 1`);
  return <LeadCall lead={lead} scripts={scripts} goal={goal} area={area} myName={me.name}
    deal={deal ? { stage: deal.stage, quote: deal.quote_number, valueCents: deal.value_cents, nextAt: deal.next_action_at ? new Date(deal.next_action_at).toISOString() : null, nextNote: deal.next_action_note } : null}
    visit={visit ? { date: visit.visit_date, rep: visit.rep_name } : null} />;
}
