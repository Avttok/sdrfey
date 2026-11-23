import { CheckCheck, Clock, Flame, Trophy, Users } from "lucide-react";
import { GoalCard, GoalsHero, PersonHead, Ring, TeamTile } from "@/components/goal-ui";
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

export { Ring };

/** Quadro único para quem está com todas as metas desligadas. */
export function GoalsOff({ name, hex }: { name?: string; hex?: string }) {
  return (
    <section className={`${panelCls} w-full p-5`}>
      {name && <p className="mb-2 flex items-center gap-2 font-semibold"><span aria-hidden className="size-3 rounded-full" style={{ background: hex }} />{name}</p>}
      <p className="rounded-xl bg-sunk/60 px-4 py-5 text-center text-sm font-medium text-muted">Metas desativadas</p>
    </section>
  );
}

/** Resumo do dia: destaque da equipe, totais, e por pessoa (ordenadas pelo desempenho) cada meta com ritmo e previsão. Meta desligada nem aparece. */
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
  /** Média das metas ligadas da pessoa (cada uma até 100%). */
  const avgOf = (i: number) => { const r = cfg[i].filter((c) => c.on && c.qty); return r.length ? r.reduce((a, c) => a + Math.min(100, c.pct), 0) / r.length : 0; };
  const off = (i: number) => cfg[i].every((c) => !c.on);
  const order = people.map((_, i) => i).sort((a, b) => Number(off(a)) - Number(off(b)) || avgOf(b) - avgOf(a));
  const single = people.length === 1;
  const live = cfg.flat().filter((c) => c.on && c.qty);
  const hit = live.filter((c) => c.n >= c.qty).length;
  const teamPct = live.length ? live.reduce((a, c) => a + Math.min(100, c.pct), 0) / live.length : 0;
  const who = people.filter((_, i) => !off(i)).length;
  return (
    <div className="space-y-4">
      <GoalsHero eyebrow={`Metas · atendimento ${dayLabel}`} title={live.length === 0 ? "Sem metas ligadas" : teamPct >= 100 ? "Todas as metas batidas!" : `${Math.round(teamPct)}% das metas ${dayLabel}`}
        text={live.length === 0 ? "Ligue as metas na aba Editar metas." : hit === live.length ? "Equipe inteira na meta. Hora de comemorar." : `${hit} de ${live.length} metas já batidas${isToday ? ". Cada atendimento conta." : "."}`}
        pct={teamPct} chips={[{ icon: <CheckCheck size={13} aria-hidden />, label: `${hit} de ${live.length} metas batidas` }, { icon: <Users size={13} aria-hidden />, label: `${who} ${who === 1 ? "pessoa" : "pessoas"} com meta` }]} />
      {showTeam && totals.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))" }}>
          {totals.map((t) => { const M = META[t.k]; return <TeamTile key={t.k} icon={<M.Icon size={15} aria-hidden />} label={`${M.short} · equipe`} pct={t.pct} value={t.n} of={`/ ${t.qty}`} sub={t.pct >= 100 ? "Meta da equipe batida" : `faltam ${Math.max(0, t.qty - t.n)}`} />; })}
        </div>
      )}
      <ul className={people.length > 1 ? "panel-grid" : "grid gap-3"}>
        {order.map((i, idx) => {
          const p = people[i];
          const rows = cfg[i].filter((c) => c.on);
          if (rows.length === 0) return <li key={p.id} className="self-start"><GoalsOff name={p.name} hex={p.hex} /></li>;
          const pos = people.length > 1 && avgOf(i) > 0 ? idx + 1 : undefined;
          return (
            <li key={p.id} className={`${panelCls} space-y-4 ${single ? "p-6" : "p-5"}`}>
              <PersonHead name={p.name} hex={p.hex} pct={avgOf(i)} pos={pos} sub={dayLabel} />
              <ul className={single ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
                {rows.map((c) => {
                  const M = META[c.k], pc = paces[p.id]?.[c.k], done = c.qty > 0 && c.n >= c.qty;
                  return (
                    <GoalCard key={c.k} icon={<M.Icon size={17} aria-hidden />} label={M.short} pct={c.pct} done={done} value={c.n} of={`de ${c.qty} ${dayLabel}`}>
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
                    </GoalCard>
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
