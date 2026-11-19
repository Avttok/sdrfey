import { CalendarCheck, FileText, Handshake, Headset, Receipt, Shuffle, Trophy } from "lucide-react";
import { fmtBRL } from "@/config/deals";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { ClientHistory } from "@/modules/deals/history";
import { AndamentosTimeline, VisitsPanel } from "./commercial-panels";
import { StageChip } from "./deal-ui";

const OUTCOME: Record<string, string> = { deal: "Abriu negociação", no_answer: "Sem contato", no_interest: "Sem interesse", skipped: "Pulou", released: "Liberou" };

function Block({ icon: I, title, count, children }: { icon: typeof Receipt; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><I size={14} aria-hidden />{title}{count !== undefined && <span className="figure rounded-full bg-sunk px-1.5 text-[11px] normal-case">{count}</span>}</h3>
      {children}
    </section>
  );
}
const Empty = ({ t }: { t: string }) => <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">{t}</p>;

/** Tudo que o sistema sabe de um cliente, em blocos. Usado no Shuffler de vendas e no aviso de cliente que já está na carteira. */
export function ClientHistoryView({ h, maxH = "max-h-60" }: { h: ClientHistory; maxH?: string }) {
  const { commercial: c, totals: t } = h;
  const won = c.deals.filter((d) => d.stage === "ganho");
  const quoteDeal = new Map(c.deals.map((d) => [d.id, d]));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["Faturado", fmtBRL(t.billedCents), Trophy], ["Vendas", String(t.billedCount), Receipt], ["Cotações", String(t.quotes), FileText], ["Negociações", String(t.deals), Handshake]] as const).map(([l, v, I]) => (
          <div key={l} className="rounded-xl bg-sunk/60 px-3 py-2.5"><p className="flex items-center gap-1.5 text-[11px] font-medium text-muted"><I size={12} aria-hidden />{l}</p><p className="figure mt-0.5 text-lg font-bold leading-tight">{v}</p></div>
        ))}
      </div>
      {h.sellers.length > 0 && <p className="text-sm text-muted">Já foi atendido por <b className="text-ink">{h.sellers.join(", ")}</b>.</p>}

      <Block icon={Receipt} title="Faturamentos" count={won.length}>
        {won.length === 0 ? <Empty t="Nenhum faturamento no sistema." /> : (
          <ul className={`${maxH} divide-y divide-line/70 overflow-y-auto rounded-xl border border-line text-sm`}>
            {won.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2"><b className="figure">{fmtBRL(d.mainCents)}</b><span className="text-muted">{d.closedOn ? fmtDate(d.closedOn) : fmtDate(d.createdAt)}</span>{d.orderNumber && <span className="figure text-xs text-muted">Pedido {d.orderNumber}</span>}<span className="ml-auto text-xs text-muted">{d.sellerName ?? "sem vendedor"}</span></li>)}
          </ul>
        )}
      </Block>

      <Block icon={FileText} title="Cotações" count={c.quotes.length}>
        {c.quotes.length === 0 ? <Empty t="Nenhuma cotação registrada." /> : (
          <ul className={`${maxH} divide-y divide-line/70 overflow-y-auto rounded-xl border border-line text-sm`}>
            {c.quotes.map((q) => <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2"><b>{q.number ?? `#${q.id}`}</b><span className="figure">{fmtBRL(q.totalCents)}</span><span className="text-muted">{q.quoteDate ? fmtDate(q.quoteDate) : ""}</span><span className="ml-auto"><StageChip stage={quoteDeal.get(q.dealId)?.stage ?? "cotacao"} /></span></li>)}
          </ul>
        )}
      </Block>

      <Block icon={Handshake} title="Negociações" count={c.deals.length}>
        {c.deals.length === 0 ? <Empty t="Nenhuma negociação." /> : (
          <ul className={`${maxH} divide-y divide-line/70 overflow-y-auto rounded-xl border border-line text-sm`}>
            {c.deals.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2"><StageChip stage={d.stage} /><span className="figure">{fmtBRL(d.mainCents)}</span><span className="text-muted">{fmtDate(d.createdAt)}</span><span className="ml-auto text-xs text-muted">{d.sellerName ?? "sem vendedor"}</span></li>)}
          </ul>
        )}
      </Block>

      <Block icon={Headset} title="Atendimentos do SDR" count={h.interactions.length}>
        {h.interactions.length === 0 ? <Empty t="Nenhum atendimento registrado." /> : (
          <ul className={`${maxH} space-y-1.5 overflow-y-auto text-sm`}>
            {h.interactions.map((a, i) => <li key={i}><b>{a.channel}</b> <span className="text-xs text-muted">{fmtDateTime(a.at)}{a.by ? ` · ${a.by}` : ""}</span>{a.note && <span className="block whitespace-pre-wrap text-xs text-muted">{a.note}</span>}</li>)}
          </ul>
        )}
      </Block>

      {h.shuffles.length > 0 && (
        <Block icon={Shuffle} title="Shuffler de vendas" count={h.shuffles.length}>
          <ul className="space-y-1 text-sm">{h.shuffles.map((s, i) => <li key={i}><b>{OUTCOME[s.outcome ?? ""] ?? "Em aberto"}</b> <span className="text-xs text-muted">{fmtDateTime(s.at)}{s.by ? ` · ${s.by}` : ""}</span>{s.note && <span className="block text-xs text-muted">{s.note}</span>}</li>)}</ul>
        </Block>
      )}

      <Block icon={CalendarCheck} title="Andamentos e visitas" count={c.events.length + c.visits.length}>
        {c.events.length === 0 && c.visits.length === 0 ? <Empty t="Nada registrado." /> : (
          <div className="space-y-3">
            {c.events.length > 0 && <AndamentosTimeline events={c.events} showDeal maxH={maxH} />}
            {c.visits.length > 0 && <VisitsPanel visits={c.visits} />}
          </div>
        )}
      </Block>
    </div>
  );
}
