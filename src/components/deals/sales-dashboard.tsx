import { BellRing, Crown, CalendarCheck, CalendarClock, CircleDollarSign, FileText, Handshake, Hourglass, PhoneCall, Percent, Shuffle, Timer, TrendingDown, Trophy, Wallet, Workflow } from "lucide-react";
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

function Ring({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value)); const r = 22; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="size-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--sunk)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-1000" />
    </svg>
  );
}
function Kpi({ I, t, v, s, hot, hex = "#378ADD", i = 0 }: { I: typeof Wallet; t: string; v: string; s: string; hot?: boolean; hex?: string; i?: number }) {
  const c = hot ? "var(--danger)" : hex;
  return (
    <div style={{ "--i": i } as React.CSSProperties} className={`${panelCls} card-in lift relative overflow-hidden p-4 hover:shadow-lg ${hot ? "border-danger/50" : ""}`}>
      <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-[.13]" style={{ background: c }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{t}</p>
          <p className="figure mt-2 text-3xl font-extrabold leading-none" style={hot ? { color: c } : undefined}>{v}</p>
          <p className="mt-2 text-xs text-muted">{s}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm" style={{ background: c }}><I size={20} aria-hidden /></span>
      </div>
    </div>
  );
}
const Block = ({ icon: I, title, children }: { icon: typeof Wallet; title: string; children: React.ReactNode }) => (
  <section className={`${panelCls} card-in relative overflow-hidden p-5`}>
    <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-grad opacity-80" />
    <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-bold"><span className="grid size-9 place-items-center rounded-xl bg-grad text-on-accent shadow-sm"><I size={17} aria-hidden /></span> {title}</h2>
    {children}
  </section>
);
const MEDAL = ["#F5B301", "#A8B0BA", "#C57B3A"];

/** Números de vendas: usado no Dashboard do vendedor e no bloco “Vendas da equipe” do gestor. */
export function SalesDashboard({ s, showRanking }: { s: SalesStats; showRanking: boolean }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="aurora relative overflow-hidden rounded-3xl bg-grad p-5 text-on-accent shadow-lg lg:col-span-2">
          <span aria-hidden className="aurora-blob a" /><span aria-hidden className="aurora-blob b" />
          <div className="relative grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-widest opacity-80">Vendas fechadas</p><p className="figure mt-1 text-4xl font-extrabold leading-none sm:text-5xl">{fmtBRL(s.wonValue)}</p><p className="mt-2 text-sm opacity-90">{nf.format(s.won)} {s.won === 1 ? "venda" : "vendas"} no período</p></div>
            <div className="sm:border-l sm:border-white/25 sm:pl-5"><p className="text-xs font-bold uppercase tracking-widest opacity-80">Em negociação</p><p className="figure mt-1 text-3xl font-extrabold leading-none sm:text-4xl">{fmtBRL(s.stages.reduce((a, r) => a + r.v, 0))}</p><p className="mt-2 text-sm opacity-90">{nf.format(s.open)} {s.open === 1 ? "negociação aberta" : "negociações abertas"}</p></div>
          </div>
        </div>
        <div className={`${panelCls} card-in flex items-center gap-4 p-5`}>
          <Ring value={(s.conversion ?? 0) * 100} color="var(--ok)" />
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Conversão</p><p className="figure text-4xl font-extrabold leading-none">{pct(s.conversion)}</p><p className="mt-1.5 text-xs text-muted">{s.won} ganhas · {s.lost} perdidas</p></div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi i={0} hex="#378ADD" I={Handshake} t="Em andamento" v={nf.format(s.open)} s="negociações abertas" />
        <Kpi i={1} hex="#7F77DD" I={FileText} t="Cotações abertas" v={nf.format(s.quotesOpen)} s={s.quotesOpenValue ? fmtBRL(s.quotesOpenValue) : "aguardando resposta"} />
        <Kpi i={2} hex="#1D9E75" I={Trophy} t="Vendas fechadas" v={nf.format(s.won)} s={s.wonValue ? fmtBRL(s.wonValue) : "no período"} />
        <Kpi i={3} hex="#10b981" I={Wallet} t="Ticket médio" v={s.ticket ? fmtBRL(Math.round(s.ticket)) : "—"} s="por venda fechada" />
        <Kpi i={4} hex="#0ea5e9" I={PhoneCall} t="Contatos" v={nf.format(s.contacts)} s={`${nf.format(s.quotesSent)} cotações enviadas`} />
        <Kpi i={5} hex="#f59e0b" I={Timer} t="Tempo até o 1º contato" v={mins(s.firstContactMinutes)} s={`${nf.format(s.received)} negociações recebidas`} />
        <Kpi i={6} hex="#E24B4A" I={TrendingDown} t="Valor perdido" v={fmtBRL(s.lostValue)} s={`${nf.format(s.lost)} ${s.lost === 1 ? "perdida" : "perdidas"} no período`} />
        <Kpi i={7} hex="#BA7517" I={Hourglass} t="Ciclo de venda" v={s.cycleDays == null ? "—" : `${s.cycleDays.toFixed(1).replace(".", ",")} d`} s="da entrada ao faturamento" />
        <Kpi i={8} hex="#ec4899" I={CalendarCheck} t="Visitas" v={nf.format(s.visits.pending + s.visits.confirmed + s.visits.done)} s={`${nf.format(s.visits.done)} realizadas · ${nf.format(s.visits.confirmed)} confirmadas · ${nf.format(s.visits.pending)} aguardando`} />
        <Kpi i={9} hex="#a855f7" I={Shuffle} t="Shuffler Vendas" v={nf.format(s.shuffler.worked)} s={`${nf.format(s.shuffler.saved + s.shuffler.visit + s.shuffler.deal)} aproveitados · ${nf.format(s.shuffler.toSdr)} devolvidos ao SDR`} />
        <Kpi i={10} I={BellRing} t="Avisos" v={nf.format(s.alerts.length)} s={s.alerts.length ? "precisam de atenção" : "tudo em dia"} hot={s.alerts.length > 0} hex="#1D9E75" />
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
          {(() => { const order = ["novo", "contato", "cotacao", "negociacao"] as const; const rows = order.map((k) => ({ k, ...(s.stages.find((r) => r.stage === k) ?? { n: 0, v: 0 }) })); const max = Math.max(1, ...rows.map((r) => r.n)); return <div className="space-y-1.5">{rows.map((r) => (
            <div key={r.k} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 truncate text-muted">{STAGE_META[r.k].label}</span>
              <span className="flex h-9 flex-1 justify-center"><span className="flex h-full items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm transition-[width] duration-1000" style={{ width: `${Math.max(r.n ? 14 : 6, Math.round((r.n / max) * 100))}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${STAGE_META[r.k].color} 75%, white), ${STAGE_META[r.k].color})` }}>{r.n || ""}</span></span>
              <span className="figure min-w-24 shrink-0 text-right text-xs font-medium">{fmtBRL(r.v)}</span>
            </div>
          ))}</div>; })()}
        </Block>
        <Block icon={CalendarClock} title="Próximas visitas">
          {s.upcoming.length ? <ul className="space-y-1.5 text-sm">{s.upcoming.map((u) => <li key={u.id}><Link href={`/visitas?v=${u.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-sunk"><span className="figure shrink-0 rounded-md bg-grad px-2 py-0.5 text-xs font-bold text-on-accent">{fmtDate(u.date).slice(0, 5)}</span><span className="min-w-0 flex-1 truncate font-medium">{u.company}</span><span className="shrink-0 text-xs text-muted">{u.status === "confirmada" ? "Confirmada" : "Aguardando"}</span></Link></li>)}</ul> : <p className="text-sm text-muted">Nenhuma visita marcada pela frente.</p>}
        </Block>
      </div>
      <ShufflerBlock s={s} showRanking={showRanking} />
      {s.daily.length > 0 && (
        <Block icon={CircleDollarSign} title="Vendas por dia">
          <div className="flex h-36 items-end gap-1 border-b border-line">
            {s.daily.map((p) => <div key={p.d} title={`${fmtDate(p.d)}: ${p.n} ${p.n === 1 ? "venda" : "vendas"} · ${fmtBRL(p.v)}`} className="flex-1 rounded-t-md transition hover:brightness-110" style={{ background: "linear-gradient(180deg, var(--ok), color-mix(in srgb, var(--ok) 55%, white))", height: `${Math.max(6, (p.v / Math.max(1, ...s.daily.map((q) => q.v))) * 100)}%` }} />)}
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
                    <span className="figure grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white" style={{ background: MEDAL[i] ?? "var(--muted)" }}>{i === 0 ? <Crown size={14} aria-hidden /> : i + 1}</span>
                    <span className="w-20 shrink-0 truncate font-medium sm:w-24">{r.name.split(" ")[0]}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.max(r.value ? 3 : 0, Math.round((r.value / max) * 100))}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${hex} 70%, white), ${hex})` }} /></span>
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

const secs = (n: number | null) => (n == null ? "—" : n < 90 ? `${Math.round(n)} s` : n < 5400 ? `${Math.round(n / 60)} min` : `${(n / 3600).toFixed(1).replace(".", ",")} h`);

/** Métricas do shuffler de vendas (leads inativos sorteados): o que foi trabalhado, o que virou negócio e quem trabalha mais. */
function ShufflerBlock({ s, showRanking }: { s: SalesStats; showRanking: boolean }) {
  const h = s.shuffler;
  const used = h.saved + h.visit + h.deal;
  const closed = h.worked - h.open;
  const rows = [
    { k: "Virou negócio", n: h.deal, c: "var(--color-ok)" }, { k: "Visita marcada", n: h.visit, c: "var(--color-accent)" }, { k: "Salvo para depois", n: h.saved, c: "var(--color-accent-2, var(--color-accent))" },
    { k: "Devolvido ao SDR", n: h.toSdr, c: "var(--color-warn)" }, { k: "Não atendeu", n: h.noAnswer, c: "var(--color-muted)" }, { k: "Sem interesse", n: h.noInterest, c: "var(--color-danger)" }, { k: "Pulado", n: h.skipped, c: "var(--color-muted)" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Block icon={Shuffle} title="Shuffler Vendas">
      {h.worked === 0 ? <p className="text-sm text-muted">Nenhum lead sorteado no período. Há {nf.format(h.pool)} leads inativos disponíveis no estoque.</p> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Sorteados", nf.format(h.worked), `${nf.format(h.open)} em aberto`],
              ["Aproveitamento", pct(closed ? used / closed : null), `${nf.format(used)} de ${nf.format(closed)} finalizados`],
              ["Negócios abertos", nf.format(h.dealsOpened), `${nf.format(h.won)} faturados${h.wonValue ? ` · ${fmtBRL(h.wonValue)}` : ""}`],
              ["Tempo por lead", secs(h.avgSeconds), `${nf.format(h.pool)} no estoque`],
            ].map(([t, v, sub]) => (
              <div key={t} className="min-w-0 rounded-xl border border-line bg-sunk/50 p-3"><p className="truncate text-xs text-muted">{t}</p><p className="figure mt-0.5 text-xl font-bold">{v}</p><p className="truncate text-xs text-muted">{sub}</p></div>
            ))}
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.k} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 truncate text-muted">{r.k}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.max(r.n ? 3 : 0, Math.round((r.n / max) * 100))}%`, background: r.c }} /></span>
                <span className="figure w-10 shrink-0 text-right text-xs font-medium">{nf.format(r.n)}</span>
              </div>
            ))}
          </div>
          {showRanking && h.sellers.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="bg-sunk/60 text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Vendedor</th><th className="px-3 py-2 text-right font-medium">Sorteados</th><th className="px-3 py-2 text-right font-medium">Aproveitados</th><th className="px-3 py-2 text-right font-medium">Negócios</th><th className="px-3 py-2 text-right font-medium">Sem resposta</th><th className="px-3 py-2 text-right font-medium">Sem interesse</th><th className="px-3 py-2 text-right font-medium">Tempo médio</th></tr></thead>
                <tbody className="divide-y divide-line/60">
                  {h.sellers.map((r) => (
                    <tr key={r.id}><td className="px-3 py-2 font-medium">{r.name.split(" ")[0]}</td><td className="figure px-3 py-2 text-right">{r.worked}</td><td className="figure px-3 py-2 text-right">{r.used}</td><td className="figure px-3 py-2 text-right">{r.deals}</td><td className="figure px-3 py-2 text-right">{r.noAnswer}</td><td className="figure px-3 py-2 text-right">{r.noInterest}</td><td className="figure px-3 py-2 text-right">{secs(r.avgSeconds)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Block>
  );
}
