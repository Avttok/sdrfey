import { and, desc, eq, inArray } from "drizzle-orm";
import { Archive } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { auditLog, db, users } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { fmtBRL } from "@/config/deals";

export const dynamic = "force-dynamic";

type Snap = { empresa?: string; cnpj?: string; vendedor?: string | null; etapa?: string; cotacoes?: string[]; valorFechado?: number | null; valorReal?: number | null; pedido?: string | null; eventos?: number; itens?: number };

export default async function Page() {
  const rows = await db.select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, leadId: auditLog.leadId, meta: auditLog.meta, by: users.name })
    .from(auditLog).leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(eq(auditLog.entity, "deal"), inArray(auditLog.action, ["apagou negociação", "resetou negociação", "devolveu lead ao SDR"]))).orderBy(desc(auditLog.at)).limit(200);
  return (
    <div className="space-y-5">
      <PageHead icon={Archive} size="md" title="Negociações apagadas" subtitle="Tudo que foi apagado, resetado ou devolvido ao SDR, com a foto do que existia." />
      {rows.length === 0 && <p className="rounded-xl bg-sunk px-4 py-6 text-center text-sm text-muted">Nada foi apagado ou resetado até agora.</p>}
      <ul className="space-y-3">
        {rows.map((r) => { const s = (r.meta ?? {}) as Snap; const del = r.action.startsWith("apagou"); const back = r.action.startsWith("devolveu"); return (
          <li key={r.id} className="space-y-2 rounded-2xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${del ? "bg-danger/12 text-danger" : "bg-warn/15 text-warn"}`}>{del ? "Apagada" : back ? "Devolvida ao SDR" : "Resetada"}</span>
              <h2 className="min-w-0 flex-1 break-words font-semibold">{s.empresa ?? "—"}</h2>
              <span className="text-xs text-muted">{fmtDateTime(r.at.toISOString())} · por {r.by ?? "—"}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {([["CNPJ", s.cnpj], ["Vendedor", s.vendedor], ["Etapa na época", s.etapa], ["Nº do pedido", s.pedido], ["Valor fechado", s.valorFechado != null ? fmtBRL(s.valorFechado) : null], ["Valor real", s.valorReal != null ? fmtBRL(s.valorReal) : null], ["Eventos", s.eventos], ["Itens", s.itens]] as const).filter(([, v]) => v != null && v !== "").map(([l, v]) => <div key={l} className="flex gap-2"><dt className="text-muted">{l}:</dt><dd className="font-medium">{String(v)}</dd></div>)}
            </dl>
            {s.cotacoes && s.cotacoes.length > 0 && <p className="text-xs text-muted">Cotações: {s.cotacoes.join(" · ")}</p>}
          </li>
        ); })}
      </ul>
    </div>
  );
}
