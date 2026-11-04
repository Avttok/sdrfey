import type { Metadata } from "next";
import { AttendButton } from "@/components/attend-button";
import { panelCls } from "@/components/ui";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { requirePerm } from "@/modules/auth/guard";
import { userHistory } from "@/modules/leads/sorter";

export const metadata: Metadata = { title: "Meu histórico" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const me = await requirePerm("tab.historico");
  const rows = await userHistory(me.id);
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">Meu histórico</h1>
      <p className="text-sm text-muted">Os leads que você atendeu e salvou, do mais recente para o mais antigo. Use ATENDER para voltar a um deles.</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.sessionId} className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.company}</p>
              <p className="text-xs text-muted">{fmtDateTime(r.savedAt)} · tempo {fmtDuration(r.seconds)}{r.city ? ` · ${r.city}/${r.uf}` : ""}</p>
            </div>
            <AttendButton leadId={r.leadId} compact />
          </li>
        ))}
        {rows.length === 0 && <li className={`${panelCls} p-6 text-center text-muted`}>Você ainda não atendeu nenhum lead.</li>}
      </ul>
    </div>
  );
}
