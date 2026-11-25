import type { Metadata } from "next";
import { BellRing, FileSpreadsheet, FileText, Handshake, Trophy, UserPlus, Wallet } from "lucide-react";
import { NewDeal } from "@/components/deals/new-deal";
import { DealBoard } from "@/components/deals/deal-board";
import { PageHead } from "@/components/page-head";
import Link from "next/link";
import { btnGhost, panelCls } from "@/components/ui";
import { BOARD_COLUMNS, fmtBRL, STAGE_META } from "@/config/deals";
import { asc, eq } from "drizzle-orm";
import { db, paymentTerms } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { PrefBlock } from "@/components/deals/deal-prefs";
import { PendingEnrich } from "@/components/deals/pending-enrich";
import { pendingDealImports } from "@/modules/enrich/batch";
import { withExtras } from "@/modules/deals/extras";
import { listDeals, onePerClient } from "@/modules/deals/queries";

export const metadata: Metadata = { title: "Negociações" };
export const dynamic = "force-dynamic";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Ring({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value)); const r = 22; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="size-20 shrink-0 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--sunk)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-1000" />
    </svg>
  );
}
const tint = (hex: string) => ({ backgroundColor: "color-mix(in srgb, var(--panel) 66%, transparent)", backgroundImage: `linear-gradient(145deg, color-mix(in srgb, ${hex} 18%, transparent), color-mix(in srgb, ${hex} 4%, transparent) 70%)`, borderColor: `color-mix(in srgb, ${hex} 42%, var(--line))`, WebkitBackdropFilter: "blur(16px) saturate(1.4)", backdropFilter: "blur(16px) saturate(1.4)" });
function Kpi({ I, t, v, s, hot, hex = "#378ADD", i = 0 }: { I: typeof Wallet; t: string; v: string; s: string; hot?: boolean; hex?: string; i?: number }) {
  const c = hot ? "#ef4444" : hex;
  return (
    <div style={{ "--i": i, ...tint(c) } as React.CSSProperties} className="card-in group relative overflow-hidden rounded-3xl border-[1.5px] p-4 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)] transition hover:-translate-y-0.5 hover:shadow-xl">
      <I aria-hidden size={96} strokeWidth={1.3} className="pointer-events-none absolute -bottom-4 -right-3 -rotate-12 opacity-[.11] transition duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ color: c }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{t}</p>
          <p className="figure mt-2 text-3xl font-extrabold leading-none" style={hot ? { color: c } : undefined}>{v}</p>
          <p className="mt-2 truncate text-xs text-muted">{s}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 62%, #000))` }}><I size={20} aria-hidden /></span>
      </div>
    </div>
  );
}

/** Janela do vendedor: leads repassados pelos SDRs, com avisos do que precisa de atenção agora e filtros avançados. */
export default async function DealsPage() {
  const me = await requirePerm("tab.negociacoes");
  const team = !!me.permissions["deals.team"];
  const canClaim = me.roles.includes("seller") || team;
  const [all, waiting, terms] = await Promise.all([
    listDeals(me.id, team), pendingDealImports(),
    canClaim ? db.select({ n: paymentTerms.name }).from(paymentTerms).where(eq(paymentTerms.active, true)).orderBy(asc(paymentTerms.name)) : Promise.resolve([]),
  ]);
  const deals = await withExtras(onePerClient(all));
  const open = deals.filter((d) => d.stage !== "ganho" && d.stage !== "perdido");
  const mine = open.filter((d) => d.sellerId === me.id);
  const attention = open.filter((d) => d.alerts.length && (team || d.sellerId === me.id || !d.sellerId));
  const pool = open.filter((d) => !d.sellerId);
  const quotes = open.filter((d) => d.stage === "cotacao");
  const quotesValue = quotes.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  const openValue = open.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const billed = deals.filter((d) => d.stage === "ganho" && (d.closedOn ?? d.closedAt ?? "").slice(0, 7) === month && (team || d.sellerId === me.id));
  const billedValue = billed.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  const healthy = open.length ? 1 - open.filter((d) => d.alerts.length).length / open.length : 1;
  const funnel = BOARD_COLUMNS.filter((c) => c.key !== "ganho").map((c) => { const l = open.filter((d) => c.stages.includes(d.stage)); return { key: c.key, label: STAGE_META[c.key].label, color: STAGE_META[c.key].color, n: l.length, cents: l.reduce((a, d) => a + (d.mainCents ?? 0), 0) }; });
  const opts = {
    sellers: [...new Map(deals.filter((d) => d.sellerId).map((d) => [d.sellerId!, d.sellerName ?? "?"])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    sdrs: [...new Map(deals.filter((d) => d.sdrId).map((d) => [d.sdrId!, d.sdrName ?? "?"])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    ufs: [...new Set(deals.map((d) => d.uf).filter((u): u is string => !!u))].sort(),
  };
  return (
    <div className="space-y-5">
      <PageHead icon={Handshake} title="Negociações" subtitle="Tudo o que o SDR repassou, com avisos do que precisa de você agora.">
        {canClaim && <Link href="/negociacoes/importar" className={btnGhost}><FileSpreadsheet size={16} aria-hidden /> Importar planilha</Link>}
        {canClaim && <NewDeal terms={terms.map((t) => t.n)} />}
      </PageHead>
      {waiting > 0 && canClaim && <PendingEnrich n={waiting} />}

      <PrefBlock id="resumo"><section className="grid gap-3 lg:grid-cols-3" aria-label="Resumo das negociações">
        <div className="aurora relative overflow-hidden rounded-3xl bg-grad p-5 text-on-accent shadow-lg lg:col-span-2">
          <span aria-hidden className="aurora-blob a" /><span aria-hidden className="aurora-blob b" />
          <div className="relative grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-widest opacity-80">Em negociação agora</p><p className="figure mt-1 text-4xl font-extrabold leading-none sm:text-5xl">{fmtBRL(openValue)}</p><p className="mt-2 text-sm opacity-90">{open.length} {open.length === 1 ? "negociação aberta" : "negociações abertas"}{team ? "" : ` · ${mine.length} suas`}</p></div>
            <div className="sm:border-l sm:border-white/25 sm:pl-5"><p className="text-xs font-bold uppercase tracking-widest opacity-80">Faturado neste mês</p><p className="figure mt-1 text-3xl font-extrabold leading-none sm:text-4xl">{fmtBRL(billedValue)}</p><p className="mt-2 text-sm opacity-90">{billed.length} {billed.length === 1 ? "venda faturada" : "vendas faturadas"}</p></div>
          </div>
        </div>
        <div className="card-in card-surface card-edge flex items-center gap-4 rounded-3xl p-5">
          <div className="relative grid place-items-center"><Ring value={healthy * 100} color={healthy >= 0.8 ? "var(--ok)" : healthy >= 0.5 ? "var(--warn)" : "var(--danger)"} /><span className="figure absolute text-sm font-extrabold">{pct(healthy)}</span></div>
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Em dia</p><p className="mt-1 text-sm leading-snug">{attention.length ? <><b>{attention.length}</b> {attention.length === 1 ? "negociação pede" : "negociações pedem"} atenção agora.</> : "Nenhum aviso pendente. Tudo em dia."}</p></div>
        </div>
      </section></PrefBlock>

      <PrefBlock id="kpis"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi i={0} I={Handshake} t="Em andamento" v={String(team ? open.length : mine.length)} s={team ? "abertas na equipe" : "suas abertas"} hex="#3b82f6" />
        <Kpi i={1} I={UserPlus} t="Sem vendedor" v={String(pool.length)} s={pool.length ? "esperando vendedor" : "nenhuma esperando"} hot={pool.length > 0} />
        <Kpi i={2} I={BellRing} t="Precisam de atenção" v={String(attention.length)} s="com aviso" hot={attention.length > 0} />
        <Kpi i={3} I={FileText} t="Cotações abertas" v={String(quotes.length)} s={quotesValue ? fmtBRL(quotesValue) : "nenhuma cotação"} hex="#f59e0b" />
      </div></PrefBlock>

      {funnel.some((f) => f.n > 0) && (
        <PrefBlock id="funil"><section aria-label="Funil das negociações abertas" className="card-surface card-edge card-in relative overflow-hidden rounded-3xl p-5" style={{ "--i": 4 } as React.CSSProperties}>
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-grad opacity-80" />
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="flex items-center gap-2 text-[15px] font-bold"><Trophy size={16} className="text-accent" aria-hidden /> Funil em aberto</h2><p className="figure text-xs text-muted">{open.length} negociações{openValue ? ` · ${fmtBRL(openValue)}` : ""}</p></div>
          <div className="flex h-3.5 overflow-hidden rounded-full bg-sunk">
            {funnel.filter((f) => f.n > 0).map((f) => <span key={f.key} title={`${f.label}: ${f.n}`} className="h-full transition-all first:rounded-l-full last:rounded-r-full" style={{ width: `${(f.n / open.length) * 100}%`, background: f.color }} />)}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {funnel.map((f) => <li key={f.key} className="rounded-2xl border px-3 py-2" style={tint(f.color)}><p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted"><span aria-hidden className="size-2 rounded-full" style={{ background: f.color }} />{f.label}</p><p className="figure text-lg font-bold leading-tight">{f.n}{f.cents ? <span className="ml-2 text-xs font-medium text-muted">{fmtBRL(f.cents)}</span> : null}</p></li>)}
          </ul>
        </section></PrefBlock>
      )}
      <DealBoard deals={deals} meId={me.id} canClaim={canClaim} team={team} opts={opts} />
    </div>
  );
}
