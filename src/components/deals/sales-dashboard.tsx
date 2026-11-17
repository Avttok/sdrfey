import { BellRing, CircleDollarSign, FileText, Handshake, PhoneCall, Percent, Timer, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { panelCls } from "@/components/ui";
import { fmtBRL } from "@/config/deals";
import { bubbleHex } from "@/config/theme";
import type { Role } from "@/config/roles";
import { fmtDateTime } from "@/lib/format";
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi I={Handshake} t="Em andamento" v={nf.format(s.open)} s="negociações abertas" />
        <Kpi I={FileText} t="Cotações abertas" v={nf.format(s.quotesOpen)} s={s.quotesOpenValue ? fmtBRL(s.quotesOpenValue) : "aguardando resposta"} />
        <Kpi I={Trophy} t="Vendas fechadas" v={nf.format(s.won)} s={s.wonValue ? fmtBRL(s.wonValue) : "no período"} />
        <Kpi I={Percent} t="Conversão" v={pct(s.conversion)} s={`${s.won} ganhas · ${s.lost} perdidas`} />
        <Kpi I={Wallet} t="Ticket médio" v={s.ticket ? fmtBRL(Math.round(s.ticket)) : "—"} s="por venda fechada" />
        <Kpi I={PhoneCall} t="Contatos" v={nf.format(s.contacts)} s={`${nf.format(s.quotesSent)} cotações enviadas`} />
        <Kpi I={Timer} t="Tempo até o 1º contato" v={mins(s.firstContactMinutes)} s={`${nf.format(s.received)} negociações recebidas`} />
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
      {showRanking && s.ranking.length > 0 && (
        <Block icon={Trophy} title="Ranking de vendedores">
          <ul className="space-y-3">
            {s.ranking.map((r) => {
              const max = Math.max(1, ...s.ranking.map((x) => x.value));
              return (
                <li key={r.id} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 truncate text-muted">{r.name.split(" ")[0]}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full" style={{ width: `${Math.max(r.value ? 3 : 0, Math.round((r.value / max) * 100))}%`, background: bubbleHex(r.accent, r.id, r.roles as Role[]) }} /></span>
                  <span className="figure w-56 text-right text-xs font-medium">{r.won} {r.won === 1 ? "venda" : "vendas"} · {fmtBRL(r.value)} · {r.contacts} {r.contacts === 1 ? "contato" : "contatos"}</span>
                </li>
              );
            })}
          </ul>
        </Block>
      )}
    </div>
  );
}
