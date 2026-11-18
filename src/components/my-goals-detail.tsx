import { Clock, Flame, TrendingUp, Trophy } from "lucide-react";
import { panelCls } from "@/components/ui";
import type { SdrPace } from "@/config/pace";

const hm = (d: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Meu dia em detalhe: para cada meta ligada, o que falta, o ritmo de hoje, quando bate a meta nesse ritmo e como foram os dias anteriores. */
export function MyDayDetail({ items }: { items: { label: string; pace: SdrPace }[] }) {
  if (!items.length) return null;
  return (
    <section className={`${panelCls} space-y-4 p-5`}>
      <div><h2 className="display text-xl">Meu dia em detalhe</h2><p className="text-sm text-muted">Previsões baseadas no seu ritmo de hoje e nos seus dias anteriores.</p></div>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map(({ label, pace: p }) => {
          const pct = p.qty ? Math.min(100, (p.n / p.qty) * 100) : 0;
          return (
            <li key={p.k} className={`space-y-2.5 rounded-xl bg-sunk/40 p-4 ${p.done ? "ring-1 ring-ok/50" : ""}`}>
              <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">{label}</span><span className="figure text-sm"><b className="text-lg">{p.n}</b> <span className="text-muted">de {p.qty}</span></span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full transition-[width] duration-700 ${p.done ? "bg-ok" : "bg-grad"}`} style={{ width: `${pct}%` }} /></div>
              <p className="flex items-start gap-2 text-sm">
                {p.done ? <><Trophy size={15} className="mt-0.5 shrink-0 text-ok" aria-hidden /><span><b className="text-ok">Meta batida!</b> {p.n > p.qty ? `+${p.n - p.qty} acima.` : ""}</span></>
                  : p.etaAt ? <><Clock size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span>Faltam <b className="figure">{p.remaining}</b>. No seu ritmo de hoje ({nf.format(p.perHour!)}/h) você bate a meta por volta das <b className="figure">{hm(p.etaAt)}</b>.</span></>
                  : <><Clock size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span>Faltam <b className="figure">{p.remaining}</b>. Ainda sem ritmo hoje para prever o horário.</span></>}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-panel px-2 py-1.5"><p className="figure text-sm font-bold">{p.avg == null ? "—" : nf.format(p.avg)}</p><p className="text-muted">média diária</p></div>
                <div className="rounded-lg bg-panel px-2 py-1.5"><p className="figure text-sm font-bold">{p.best}</p><p className="text-muted"><Flame size={11} className="mr-0.5 inline" aria-hidden />melhor dia</p></div>
                <div className="rounded-lg bg-panel px-2 py-1.5"><p className="figure text-sm font-bold">{p.daysHit}/{p.daysWorked}</p><p className="text-muted">dias na meta</p></div>
              </div>
              {p.vsAvg != null && !p.done && <p className="flex items-center gap-1.5 text-xs text-muted"><TrendingUp size={12} aria-hidden />{p.vsAvg >= 0 ? `Você já está ${nf.format(p.vsAvg)} acima da sua média.` : `${nf.format(-p.vsAvg)} abaixo da sua média até agora.`}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
