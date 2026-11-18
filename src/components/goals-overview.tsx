import { Clock, Flame, Trophy } from "lucide-react";
import { panelCls } from "@/components/ui";
import { KIND_ICON } from "@/components/goal-icons";
import type { GoalPerson } from "@/components/goals-form";
import type { SdrPace } from "@/config/pace";
import { SDR_KINDS, type GoalKind } from "@/modules/settings/goals";

type Kind = GoalKind;
const KS = SDR_KINDS.map((d) => d.k) as Kind[];
type Global = Record<Kind, { on: boolean; qty: number }>;
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const hm = (d: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);

export function Ring({ pct, size = 64, children }: { pct: number; size?: number; children?: React.ReactNode }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, done = pct >= 100;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} stroke="var(--sunk)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} strokeLinecap="round" stroke={done ? "var(--ok)" : "var(--accent)"} strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} style={{ transition: "stroke-dashoffset .7s" }} />
      </svg>
      <span className="figure absolute text-sm font-bold">{children ?? `${Math.round(pct)}%`}</span>
    </span>
  );
}

/** Quadro único para quem está com todas as metas desligadas. */
export function GoalsOff({ name, hex }: { name?: string; hex?: string }) {
  return (
    <section className={`${panelCls} self-start p-5`}>
      {name && <p className="mb-2 flex items-center gap-2 font-semibold"><span aria-hidden className="size-3 rounded-full" style={{ background: hex }} />{name}</p>}
      <p className="rounded-xl bg-sunk/60 px-4 py-5 text-center text-sm font-medium text-muted">Metas desativadas</p>
    </section>
  );
}

/** Resumo do dia: total da equipe e, por pessoa, uma meta embaixo da outra com ritmo e previsão. Meta desligada nem aparece. */
export function SdrOverview({ global, people, paces, showTeam, isToday = true, dayLabel = "hoje" }: { global: Global; people: GoalPerson[]; paces: Record<number, Partial<Record<Kind, SdrPace>>>; showTeam: boolean; isToday?: boolean; dayLabel?: string }) {
  const cfg = people.map((p) => KS.map((k) => {
    const on = !p.off && (p.own[k].on ?? global[k].on), qty = p.own[k].qty ?? global[k].qty;
    return { k, on, qty, n: p.today[k], pct: on && qty ? (p.today[k] / qty) * 100 : 0 };
  }));
  const totals = KS.map((k, i) => {
    const rows = cfg.map((c) => c[i]).filter((c) => c.on && c.qty);
    const n = rows.reduce((a, c) => a + c.n, 0), qty = rows.reduce((a, c) => a + c.qty, 0);
    return { k, n, qty, any: rows.length > 0, pct: qty ? (n / qty) * 100 : 0 };
  }).filter((t) => t.any);
  const META = Object.fromEntries(SDR_KINDS.map((d) => [d.k, { label: d.today, short: d.label, Icon: KIND_ICON[d.k] }])) as Record<Kind, { label: string; short: string; Icon: typeof KIND_ICON.attended }>;
  const order = people.map((_, i) => i).sort((a, b) => Number(cfg[a].every((c) => !c.on)) - Number(cfg[b].every((c) => !c.on)));
  const single = people.length === 1;
  return (
    <div className="space-y-4">
      {showTeam && totals.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))" }}>
          {totals.map((t) => { const M = META[t.k]; return (
            <section key={t.k} className={`${panelCls} flex items-center gap-4 p-5`}>
              <Ring pct={t.pct} size={72} />
              <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm text-muted"><M.Icon size={15} aria-hidden /> {M.short} · equipe</p>
                <p className="figure mt-1 whitespace-nowrap text-2xl font-bold leading-none">{t.n}<span className="text-base font-medium text-muted"> / {t.qty}</span></p>
                {t.pct >= 100 && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-ok"><Trophy size={12} aria-hidden /> Meta da equipe batida</p>}</div>
            </section>
          ); })}
        </div>
      )}
      <ul className={people.length > 1 ? "panel-grid" : "grid gap-3"}>
        {order.map((i) => {
          const p = people[i];
          const rows = cfg[i].filter((c) => c.on);
          if (rows.length === 0) return <li key={p.id} className="flex flex-col"><GoalsOff name={p.name} hex={p.hex} /></li>;
          return (
            <li key={p.id} className={`${panelCls} space-y-4 ${single ? "p-6" : "p-5"}`}>
              <p className="flex items-center gap-2 text-lg font-semibold"><span aria-hidden className="size-3 rounded-full" style={{ background: p.hex }} /><span className="truncate">{p.name}</span></p>
              <ul className={single ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
                {rows.map((c) => {
                  const M = META[c.k], pc = paces[p.id]?.[c.k], done = c.qty > 0 && c.n >= c.qty;
                  return (
                    <li key={c.k} className={`rounded-xl bg-sunk/40 p-4 ${done ? "ring-1 ring-ok/50" : ""}`}>
                      <div className="flex items-center gap-2">
                        <M.Icon size={16} className="shrink-0 text-accent" aria-hidden />
                        <span className="flex-1 font-semibold">{M.short}</span>
                        <b className={`figure text-sm ${done ? "text-ok" : ""}`}>{Math.round(c.pct)}%</b>
                      </div>
                      <p className="figure mt-1 text-sm"><b className="text-xl">{c.n}</b> <span className="text-muted">de {c.qty} {dayLabel}</span></p>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full transition-[width] duration-700 ${done ? "bg-ok" : "bg-grad"}`} style={{ width: `${Math.min(100, c.pct)}%` }} /></div>
                      {!isToday && <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">{done ? <><Trophy size={13} className="shrink-0 text-ok" aria-hidden /><b className="text-ok">Meta batida{c.n > c.qty ? ` (+${c.n - c.qty})` : ""}</b></> : <>Ficou <b className="figure text-ink">{c.qty - c.n}</b> abaixo da meta</>}</p>}
                      {isToday && pc && (
                        <div className="mt-2.5 space-y-1.5 text-xs text-muted">
                          <p className="flex items-start gap-1.5">
                            {done ? <><Trophy size={13} className="mt-px shrink-0 text-ok" aria-hidden /><span><b className="text-ok">Meta batida!</b>{c.n > c.qty ? ` +${c.n - c.qty} acima.` : ""}</span></>
                              : pc.etaAt ? <><Clock size={13} className="mt-px shrink-0 text-accent" aria-hidden /><span>Faltam <b className="figure text-ink">{pc.remaining}</b> · ritmo de {nf.format(pc.perHour!)}/h → bate a meta por volta das <b className="figure text-ink">{hm(pc.etaAt)}</b></span></>
                              : <><Clock size={13} className="mt-px shrink-0" aria-hidden /><span>Faltam <b className="figure text-ink">{pc.remaining}</b> · sem ritmo hoje para prever o horário</span></>}
                          </p>
                          <p className="figure flex flex-wrap gap-x-3"><span>média {pc.avg == null ? "—" : nf.format(pc.avg)}/dia</span><span><Flame size={11} className="mr-0.5 inline" aria-hidden />melhor dia {pc.best}</span><span>{pc.daysHit}/{pc.daysWorked} dias na meta</span></p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
