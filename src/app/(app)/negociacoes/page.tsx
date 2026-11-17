import type { Metadata } from "next";
import { BellRing, CircleDollarSign, FileText, Handshake, UserPlus } from "lucide-react";
import { NewDeal } from "@/components/deals/new-deal";
import { DealBoard } from "@/components/deals/deal-board";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { fmtBRL } from "@/config/deals";
import { asc, eq } from "drizzle-orm";
import { db, paymentTerms } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { listDeals } from "@/modules/deals/queries";

export const metadata: Metadata = { title: "Negociações" };
export const dynamic = "force-dynamic";

/** Janela do vendedor: leads repassados pelos SDRs, com avisos do que precisa de atenção agora. */
export default async function DealsPage() {
  const me = await requirePerm("tab.negociacoes");
  const team = !!me.permissions["deals.team"];
  const canClaim = me.roles.includes("seller") || team;
  const deals = await listDeals(me.id, team);
  const open = deals.filter((d) => d.stage !== "ganho" && d.stage !== "perdido");
  const mine = open.filter((d) => d.sellerId === me.id);
  const attention = open.filter((d) => d.alerts.length && (team || d.sellerId === me.id || !d.sellerId));
  const pool = open.filter((d) => !d.sellerId);
  const quotes = open.filter((d) => d.stage === "cotacao");
  const quotesValue = quotes.reduce((a, d) => a + (d.valueCents ?? 0), 0);
  const stats = [
    { I: Handshake, t: "Em andamento", v: String(team ? open.length : mine.length), s: team ? "negociações abertas" : "suas negociações abertas" },
    { I: UserPlus, t: "Sem vendedor", v: String(pool.length), s: pool.length ? "esperando alguém assumir" : "grupo em dia", hot: pool.length > 0 },
    { I: BellRing, t: "Precisam de atenção", v: String(attention.length), s: "ligar, cobrar ou retomar", hot: attention.length > 0 },
    { I: FileText, t: "Cotações abertas", v: String(quotes.length), s: quotesValue ? fmtBRL(quotesValue) : "nenhuma cotação" },
  ];
  return (
    <div className="space-y-5">
      <PageHead icon={Handshake} title="Negociações" subtitle="Clientes repassados pelos SDRs: ligue, envie cotações e feche. Os avisos mostram o que não pode esperar.">
        {canClaim && <NewDeal terms={(await db.select({ n: paymentTerms.name }).from(paymentTerms).where(eq(paymentTerms.active, true)).orderBy(asc(paymentTerms.name))).map((t) => t.n)} />}
      </PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ I, t, v, s, hot }) => (
          <div key={t} className={`${panelCls} p-4 ${hot ? "border-danger/50" : ""}`}>
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{t}</p><span className={`grid size-8 place-items-center rounded-lg ${hot ? "bg-danger/15 text-danger" : "bg-grad-soft text-accent"}`}><I size={15} aria-hidden /></span></div>
            <p className="figure mt-2 text-3xl font-bold leading-none">{v}</p>
            <p className="mt-1.5 truncate text-xs text-muted">{s}</p>
          </div>
        ))}
      </div>
      <DealBoard deals={deals} meId={me.id} canClaim={canClaim} team={team} />
      <p className="flex items-center gap-2 text-xs text-muted"><CircleDollarSign size={14} aria-hidden /> Visitas de representante levam dias para confirmar e ficam na aba Visitas; aqui o contato é imediato.</p>
    </div>
  );
}
