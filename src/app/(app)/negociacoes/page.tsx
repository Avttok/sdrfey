import type { Metadata } from "next";
import { BellRing, FileSpreadsheet, FileText, Handshake, UserPlus } from "lucide-react";
import { NewDeal } from "@/components/deals/new-deal";
import { DealBoard } from "@/components/deals/deal-board";
import { PageHead } from "@/components/page-head";
import Link from "next/link";
import { btnGhost, panelCls } from "@/components/ui";
import { BOARD_COLUMNS, fmtBRL, STAGE_META } from "@/config/deals";
import { asc, eq } from "drizzle-orm";
import { db, paymentTerms } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { PendingEnrich } from "@/components/deals/pending-enrich";
import { pendingDealImports } from "@/modules/enrich/batch";
import { listDeals } from "@/modules/deals/queries";

export const metadata: Metadata = { title: "Negociações" };
export const dynamic = "force-dynamic";

/** Janela do vendedor: leads repassados pelos SDRs, com avisos do que precisa de atenção agora. */
export default async function DealsPage() {
  const me = await requirePerm("tab.negociacoes");
  const team = !!me.permissions["deals.team"];
  const canClaim = me.roles.includes("seller") || team;
  const [deals, waiting] = await Promise.all([listDeals(me.id, team), pendingDealImports()]);
  const open = deals.filter((d) => d.stage !== "ganho" && d.stage !== "perdido");
  const mine = open.filter((d) => d.sellerId === me.id);
  const attention = open.filter((d) => d.alerts.length && (team || d.sellerId === me.id || !d.sellerId));
  const pool = open.filter((d) => !d.sellerId);
  const quotes = open.filter((d) => d.stage === "cotacao");
  const quotesValue = quotes.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  const openValue = open.reduce((a, d) => a + (d.mainCents ?? 0), 0);
  const funnel = BOARD_COLUMNS.filter((c) => c.key !== "ganho").map((c) => { const l = open.filter((d) => c.stages.includes(d.stage)); return { key: c.key, label: STAGE_META[c.key].label, color: STAGE_META[c.key].color, n: l.length, cents: l.reduce((a, d) => a + (d.mainCents ?? 0), 0) }; });
  const stats = [
    { I: Handshake, t: "Em andamento", v: String(team ? open.length : mine.length), s: team ? "abertas" : "suas abertas" },
    { I: UserPlus, t: "Sem vendedor", v: String(pool.length), s: pool.length ? "esperando vendedor" : "nenhuma", hot: pool.length > 0 },
    { I: BellRing, t: "Precisam de atenção", v: String(attention.length), s: "com aviso", hot: attention.length > 0 },
    { I: FileText, t: "Cotações abertas", v: String(quotes.length), s: quotesValue ? fmtBRL(quotesValue) : "nenhuma cotação" },
  ];
  return (
    <div className="space-y-5">
      <PageHead icon={Handshake} title="Negociações">
        {canClaim && <Link href="/negociacoes/importar" className={btnGhost}><FileSpreadsheet size={16} aria-hidden /> Importar planilha</Link>}
        {canClaim && <NewDeal terms={(await db.select({ n: paymentTerms.name }).from(paymentTerms).where(eq(paymentTerms.active, true)).orderBy(asc(paymentTerms.name))).map((t) => t.n)} />}
      </PageHead>
      {waiting > 0 && canClaim && <PendingEnrich n={waiting} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ I, t, v, s, hot }, i) => (
          <div key={t} style={{ "--i": i } as React.CSSProperties} className={`${panelCls} stat-glow lift card-in p-4 ${hot ? "border-danger/50" : ""}`}>
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{t}</p><span className={`grid size-8 place-items-center rounded-lg ${hot ? "bg-danger/15 text-danger" : "bg-grad-soft text-accent"}`}><I size={15} aria-hidden /></span></div>
            <p className="figure mt-2 text-3xl font-bold leading-none">{v}</p>
            <p className="mt-1.5 truncate text-xs text-muted">{s}</p>
          </div>
        ))}
      </div>
      {funnel.some((f) => f.n > 0) && (
        <section aria-label="Funil das negociações abertas" className={`${panelCls} card-in p-4`} style={{ "--i": 4 } as React.CSSProperties}>
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold">Funil em aberto</p><p className="figure text-xs text-muted">{open.length} negociações{openValue ? ` · ${fmtBRL(openValue)}` : ""}</p></div>
          <div className="flex h-3 overflow-hidden rounded-full bg-sunk">
            {funnel.filter((f) => f.n > 0).map((f) => <span key={f.key} title={`${f.label}: ${f.n}`} className="h-full transition-all first:rounded-l-full last:rounded-r-full" style={{ width: `${(f.n / open.length) * 100}%`, background: f.color }} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
            {funnel.map((f) => <li key={f.key} className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: f.color }} />{f.label} <b className="figure text-ink">{f.n}</b>{f.cents ? <span className="figure">· {fmtBRL(f.cents)}</span> : null}</li>)}
          </ul>
        </section>
      )}
      <DealBoard deals={deals} meId={me.id} canClaim={canClaim} team={team} />
    </div>
  );
}
