import { Coins, Medal, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { panelCls } from "@/components/ui";
import { fmtBRL } from "@/config/deals";
import type { Hero } from "@/modules/dashboard/hero";

const nf = new Intl.NumberFormat("pt-BR");
const hour = () => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));

/** Topo do Dashboard: saudação, andamento de hoje, moedas e a próxima conquista. */
export function DashHero({ name, h }: { name: string; h: Hero }) {
  const hr = hour();
  const hi = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  const pct = h.attendedGoal ? Math.min(100, Math.round((h.attended / h.attendedGoal) * 100)) : null;
  const card = `${panelCls} sh-rise p-5`;
  return (
    <section className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
      <div className={`${card} relative overflow-hidden`}>
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-accent/15 blur-2xl" />
        <p className="flex items-center gap-2 text-sm text-muted"><Sun size={15} className="text-accent" aria-hidden /> {hi}</p>
        <h2 className="display mt-1 text-3xl">{name.split(" ")[0]}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/conquistas" className="inline-flex items-center gap-2 rounded-full bg-grad px-3.5 py-1.5 text-sm font-bold text-on-accent shadow transition hover:brightness-110"><Coins size={15} aria-hidden /><span className="figure">{nf.format(h.coins)}</span> moedas</Link>
          <Link href="/conquistas" className="inline-flex items-center gap-2 rounded-full border border-line bg-sunk px-3.5 py-1.5 text-sm font-semibold transition hover:border-accent/50"><Medal size={15} className="text-accent" aria-hidden /><span className="figure">{h.earned}/{h.total}</span> conquistas</Link>
        </div>
      </div>

      <div className={card} style={{ animationDelay: ".08s" }}>
        {h.isSdr && pct !== null ? (
          <>
            <p className="text-sm font-semibold text-muted">Atendidos hoje</p>
            <p className="figure mt-1 text-4xl font-bold leading-none">{h.attended}<span className="text-lg font-medium text-muted"> / {h.attendedGoal}</span></p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full ${pct >= 100 ? "bg-ok" : "bg-grad"}`} style={{ width: `${pct}%`, transition: "width 1s" }} /></div>
            <p className="mt-2 text-xs text-muted">{pct >= 100 ? "Meta do dia batida!" : `faltam ${h.attendedGoal - h.attended}`}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted">Vendas do mês</p>
            <p className="figure mt-1 text-3xl font-bold leading-none">{fmtBRL(h.billedCents)}</p>
            <p className="mt-3 text-xs text-muted">{h.billed} {h.billed === 1 ? "faturamento" : "faturamentos"} · {h.open} {h.open === 1 ? "negociação aberta" : "negociações abertas"}</p>
            {h.isSeller && <Link href="/shuffler-vendas" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">{h.inactive} inativos livres no Shuffler →</Link>}
          </>
        )}
      </div>

      <div className={card} style={{ animationDelay: ".16s" }}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-muted"><Sparkles size={14} className="text-accent" aria-hidden /> Próxima conquista</p>
        {h.next ? (
          <>
            <p className="mt-1 truncate font-semibold">{h.next.name}</p>
            <p className="line-clamp-2 text-xs text-muted">{h.next.desc}</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-grad" style={{ width: `${Math.round(h.next.ratio * 100)}%`, transition: "width 1s" }} /></div>
            <p className="figure mt-1.5 text-xs text-muted">{nf.format(Math.round(h.next.value))} de {nf.format(h.next.goal)}</p>
          </>
        ) : <p className="mt-2 text-sm text-muted">Você conquistou todas!</p>}
      </div>
    </section>
  );
}
