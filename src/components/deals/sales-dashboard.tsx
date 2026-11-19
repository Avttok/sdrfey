import { BellRing, CalendarCheck, CalendarClock, CircleDollarSign, FileText, Handshake, Hourglass, PhoneCall, Percent, Shuffle, Timer, TrendingDown, Trophy, Wallet, Workflow } from "lucide-react";
import Link from "next/link";
import { panelCls } from "@/components/ui";
import { fmtBRL, STAGE_META } from "@/config/deals";
import { bubbleHex } from "@/config/theme";
import type { Role } from "@/config/roles";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { SalesStats } from "@/modules/deals/stats";

const nf = new Intl.NumberFormat("pt-BR");
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const mins = (m: number | null) => (m == null ? "—" : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1).replace(".", ",")} h` : `${(m / 1440).toFixed(1).replace(".", ",")} d`);

function Kpi({ I, t, v, s, hot }: { I: typeof Wallet; t: string; v: string; s: string; hot?: boolean }) {
  return (
    <div className={`${panelCls} p-4 transition hover:border-accent/50 hover:shadow-md ${hot ? "border-danger/50" : ""}`}>
      <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{t}</p><span className={`grid size-8 place-items-center rounded-lg ${hot ? "bg-danger/15 text-danger" : "bg-grad-soft text-accent"}`}><I size={15} aria-hidden /></span></div>
      <p className="figure mt-2 text-3xl font-bold leading-none">{v}</p>
      <p className="mt-1.5 text-xs text-muted">{s}</p>
    </div>
  );
}
const Block = ({ icon: I, title, children }: { icon: typeof Wallet; title: string; children: React.ReactNode }) => (
  <section className={`${panelCls} p-5`}>
    <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><I size={16} aria-hidden /></span> {title}</h2>
    {children}
  </section>
);

/** Números de vendas: usado no Dashboard do vendedor e no bloco “Vendas da equipe” do gestor. */
export function SalesDashboard({ s, showRanking }: { s: SalesStats; showRanking: boolean }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi I={Handshake} t="Em andamento" v={nf.format(s.open)} s="negociações abertas" />
        <Kpi I={FileText} t="Cotações abertas" v={nf.format(s.quotesOpen)} s={s.quotesOpenValue ? fmtBRL(s.quotesOpenValue) : "aguardando resposta"} />
        <Kpi I={Trophy} t="Vendas fechadas" v={nf.format(s.won)} s={s.wonValue ? fmtBRL(s.wonValue) : "no período"} />
        <Kpi I={Percent} t="Conversão" v={pct(s.conversion)} s={`${s.won} ganhas · ${s.lost} perdidas`} />
        <Kpi I={Wallet} t="Ticket médio" v={s.ticket ? fmtBRL(Math.round(s.ticket)) : "—"} s="por venda fechada" />
        <Kpi I={PhoneCall} t="Contatos" v={nf.format(s.contacts)} s={`${nf.format(s.quotesSent)} cotações enviadas`} />
        <Kpi I={Timer} t="Tempo até o 1º contato" v={mins(s.firstContactMinutes)} s={`${nf.format(s.received)} negociações recebidas`} />
        <Kpi I={Wallet} t="Valor em negociação" v={fmtBRL(s.stages.reduce((a, r) => a + r.v, 0))} s={`${nf.format(s.open)} negociações abertas`} />
        <Kpi I={TrendingDown} t="Valor perdido" v={fmtBRL(s.lostValue)} s={`${nf.format(s.lost)} ${s.lost === 1 ? "perdida" : "perdidas"} no período`} />
        <Kpi I={Hourglass} t="Ciclo de venda" v={s.cycleDays == null ? "—" : `${s.cycleDays.toFixed(1).replace(".", ",")} d`} s="da entrada ao faturamento" />
        <Kpi I={CalendarCheck} t="Visitas" v={nf.format(s.visits.pending + s.visits.confirmed + s.visits.done)} s={`${nf.format(s.visits.done)} realizadas · ${nf.format(s.visits.confirmed)} confirmadas · ${nf.format(s.visits.pending)} aguardando`} />
        <Kpi I={Shuffle} t="Shuffler de vendas" v={nf.format(s.shuffler.worked)} s={`${nf.format(s.shuffler.saved + s.shuffler.visit + s.shuffler.deal)} aproveitados · ${nf.format(s.shuffler.toSdr)} devolvidos ao SDR`} />
        <Kpi I={BellRing} t="Avisos" v={nf.format(s.alerts.length)} s={s.alerts.length ? "precisam de atenção" : "tudo em dia"} hot={s.alerts.length > 0} />
      </div>
      <div className="panel-grid">
        <Block icon={BellRing} title="Precisa de atenção">
          {s.alerts.length ? (
            <ul className="space-y-2 text-sm">
              {s.alerts.slice(0, 8).map((a) => (
                <li key={a.id}><Link href={`/negociacoes/${a.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-sunk"><span aria-hidden className={`size-2 shrink-0 rounded-full ${a.tone === "danger" ? "bg-danger" : "bg-warn"}`} /><span className="min-w-0 flex-1 truncate font-medium">{a.company}</span><span className="shrink-0 text-xs text-muted">{a.text}</span></Link></li>
              ))}
              {s.alerts.length > 8 && <li className="px-2 text-xs text-muted">e mais {s.alerts.length - 8}…</li>}
            </ul>
          ) : <p className="text-sm text-muted">Nada pendente. Bom trabalho!</p>}
        </Block>
        <Block icon={CircleDollarSign} title="Vendas recentes">
          {s.recent.length ? <ul className="space-y-1.5 text-sm">{s.recent.map((r) => <li key={r.id} className="flex items-center gap-2"><Link href={`/negociacoes/${r.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">{r.company}</Link><b className="figure shrink-0 text-ok">{fmtBRL(r.value)}</b><span className="shrink-0 text-xs text-muted">{fmtDateTime(r.at).slice(0, 10)}</span></li>)}</ul> : <p className="text-sm text-muted">Nenhuma venda fechada no período.</p>}
        </Block>
      </div>
      <div className="panel-grid">
        <Block icon={Workflow} title="Funil de negociações">
          {(() => { const order = ["novo", "contato", "cotacao", "negociacao"] as const; const rows = order.map((k) => ({ k, ...(s.stages.find((r) => r.stage === k) ?? { n: 0, v: 0 }) })); const max = Math.max(1, ...rows.map((r) => r.n)); return rows.map((r) => (
            <div key={r.k} className="mb-2.5 flex items-center gap-3 text-sm last:mb-0">
              <span className="w-24 shrink-0 truncate text-muted">{STAGE_META[r.k].label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full" style={{ width: `${Math.max(r.n ? 3 : 0, Math.round((r.n / max) * 100))}%`, background: STAGE_META[r.k].color }} /></span>
              <span className="figure min-w-28 shrink-0 text-right text-xs font-medium">{r.n} · {fmtBRL(r.v)}</span>
            </div>
          )); })()}
        </Block>
        <Block icon={CalendarClock} title="Próximas visitas">
          {s.upcoming.length ? <ul className="space-y-1.5 text-sm">{s.upcoming.map((u) => <li key={u.id}><Link href={`/visitas?v=${u.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-sunk"><span className="figure shrink-0 rounded-md bg-grad px-2 py-0.5 text-xs font-bold text-on-accent">{fmtDate(u.date).slice(0, 5)}</span><span className="min-w-0 flex-1 truncate font-medium">{u.company}</span><span className="shrink-0 text-xs text-muted">{u.status === "confirmada" ? "Confirmada" : "Aguardando"}</span></Link></li>)}</ul> : <p className="text-sm text-muted">Nenhuma visita marcada pela frente.</p>}
        </Block>
      </div>
      {s.daily.length > 0 && (
        <Block icon={CircleDollarSign} title="Vendas por dia">
          <div className="flex h-24 items-end gap-1">
            {s.daily.map((p) => <div key={p.d} title={`${fmtDate(p.d)}: ${p.n} ${p.n === 1 ? "venda" : "vendas"} · ${fmtBRL(p.v)}`} className="flex-1 rounded-t bg-ok/80 transition hover:bg-ok" style={{ height: `${Math.max(6, (p.v / Math.max(1, ...s.daily.map((q) => q.v))) * 100)}%` }} />)}
          </div>
          <p className="mt-2 text-xs text-muted">{fmtDate(s.daily[0].d)} a {fmtDate(s.daily[s.daily.length - 1].d)} · passe o mouse nas barras para ver cada dia</p>
        </Block>
      )}
      {showRanking && s.ranking.length > 0 && (
        <Block icon={Trophy} title="Ranking de vendedores">
          <ul className="space-y-3.5">
            {s.ranking.map((r, i) => {
              const max = Math.max(1, ...s.ranking.map((x) => x.value));
              const hex = bubbleHex(r.accent, r.id, r.roles as Role[]);
              return (
                <li key={r.id} className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="figure w-5 shrink-0 text-center text-xs text-muted">{i + 1}º</span>
                    <span className="w-20 shrink-0 truncate font-medium sm:w-24">{r.name.split(" ")[0]}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full" style={{ width: `${Math.max(r.value ? 3 : 0, Math.round((r.value / max) * 100))}%`, background: hex }} /></span>
                    <span className="figure shrink-0 whitespace-nowrap text-right text-sm font-bold">{fmtBRL(r.value)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pl-8 text-xs text-muted">
                    <span className="whitespace-nowrap"><b className="figure text-ink">{r.won}</b> {r.won === 1 ? "venda" : "vendas"}</span>
                    <span className="whitespace-nowrap"><b className="figure text-ink">{r.quotes}</b> {r.quotes === 1 ? "cotação" : "cotações"} · <b className="figure text-ink">{fmtBRL(r.quotesValue)}</b></span>
                    <span className="whitespace-nowrap"><b className="figure text-ink">{r.contacts}</b> {r.contacts === 1 ? "contato" : "contatos"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Block>
      )}
    </div>
  );
}
