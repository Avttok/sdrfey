import { PersonBubble } from "@/components/person-bubble";
import { plural } from "@/lib/format";
import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { AlertTriangle, LayoutDashboard, CalendarCheck, Clock, Database, Flame, MessagesSquare, Percent, Timer, Target, Trophy, Filter as FunnelIcon, PhoneCall, CircleCheck } from "lucide-react";
import { Suspense } from "react";
import { DashboardFilters } from "@/components/dashboard-filters";
import { panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import { SalesDashboard } from "@/components/deals/sales-dashboard";
import { isSellerOnly } from "@/config/roles";
import { db, tags, users } from "@/db";
import { getSalesStats } from "@/modules/deals/stats";
import { getSellerGoalSettings, getSellerMonth } from "@/modules/deals/goals";
import { SellerGoalPanel } from "@/components/deals/seller-goal-panel";
import { resolveSellerGoals } from "@/config/seller-goals";
import { sql } from "drizzle-orm";
import { fmtDate, fmtDateTime, fmtDuration } from "@/lib/format";
import { requirePerm } from "@/modules/auth/guard";
import { getDashboard, periodDays, resolvePeriod } from "@/modules/dashboard/stats";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";
const nf = new Intl.NumberFormat("pt-BR");
const pct = (a: number, b: number) => (b ? `${Math.min(100, Math.round((a / b) * 100))}%` : "0%");

function Bar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-3 text-sm last:mb-0">
      <span className="w-24 shrink-0 truncate text-muted">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${max ? Math.max(value ? 3 : 0, Math.round((value / max) * 100)) : 0}%`, background: color }} /></span>
      <span className="figure w-24 text-right text-xs font-medium">{right ?? nf.format(value)}</span>
    </div>
  );
}
const Block = ({ icon: I, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) => (
  <section className={`${panelCls} p-5`}>
    <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><I size={16} aria-hidden /></span> {title}</h2>
    {children}
  </section>
);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.painel");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const period = resolvePeriod({ p: one("p"), from: iso("from"), to: iso("to") });
  const team = !!me.permissions["panel.equipe"];

  if (isSellerOnly(me.roles)) {
    const [stats, month, gset, [self]] = await Promise.all([getSalesStats(period, [me.id]), getSellerMonth(me.id), getSellerGoalSettings(), db.select().from(users).where(eq(users.id, me.id))]);
    const { targets, weights } = resolveSellerGoals(gset, self.sellerGoals ?? {});
    return (
      <div className="space-y-5">
        <PageHead icon={LayoutDashboard} title="Dashboard" subtitle={`Suas vendas · ${period.preset === "hoje" ? "Hoje" : period.preset === "custom" ? `${fmtDate(period.from)} a ${fmtDate(period.to)}` : `Últimos ${period.preset} dias`}`} />
        <div className={`${panelCls} p-4`}><Suspense fallback={null}>
          <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={[]} selected={[me.id]} />
        </Suspense></div>
        <SellerGoalPanel actual={month.actual} targets={targets} weights={weights} bonusReais={month.bonusReais} bonusSales={month.bonusSales} monthLabel={month.monthLabel} />
        <SalesDashboard s={stats} showRanking={false} />
      </div>
    );
  }

  const all = await db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true), sql`not (${users.roles} = array['seller']::text[])`)).orderBy(asc(users.name));
  const people = all.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles) }));
  const picked = (Array.isArray(sp.u) ? sp.u : sp.u ? [sp.u] : []).map(Number).filter((id) => people.some((p) => p.id === id));
  const scope = team ? (picked.length ? picked : people.map((p) => p.id)) : [me.id];
  const tagColor = Object.fromEntries((await db.select({ key: tags.key, color: tags.color }).from(tags)).map((t) => [t.key, t.color]));
  const settings = await getSettings();
  const d = await getDashboard(period, scope, settings);
  const can = (k: string) => !!me.permissions[k];
  // Só do primeiro ao último horário com registro; horas vazias no meio (almoço) continuam aparecendo.
  const activeHours = d.hours.map((x) => x.h);
  const hoursRange = activeHours.length ? Array.from({ length: Math.max(...activeHours) - Math.min(...activeHours) + 1 }, (_, i) => Math.min(...activeHours) + i) : [];
  const colorOf = new Map(d.ranking.map((r) => [r.id, { hex: bubbleHex(r.accent, r.id, r.roles), name: r.name }]));
  const perHour = hoursRange.map((h) => ({ h, parts: d.hours.filter((x) => x.h === h).map((x) => ({ ...x, ...(colorOf.get(x.uid) ?? { hex: "#888780", name: "?" }) })) }));
  const maxHour = Math.max(1, ...perHour.map((x) => x.parts.reduce((a, p) => a + p.n, 0)));
  const sellersAll = can("panel.vendas") ? await db.select({ id: users.id }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`)) : [];
  const teamSales = can("panel.vendas") ? await getSalesStats(period, sellersAll.map((x) => x.id)) : null;
  const totalStock = d.stock.novos + d.stock.trabalhados + d.stock.fora + d.stock.clientes || 1;

  const kpis: { k: string; I: typeof Clock; t: string; v: string; s: string; bar?: number }[] = [
    { k: "contatos", I: PhoneCall, t: "Contatos", v: nf.format(d.contacts), s: plural(d.days, "dia", "dias") },
    { k: "meta", I: Target, t: "Meta atendidos", v: d.goal ? pct(d.contacts, d.goal) : "—", s: d.goal ? `de ${nf.format(d.goal)}` : "meta desligada", bar: d.goal ? (d.contacts / d.goal) * 100 : undefined },
    { k: "meta_agend", I: CalendarCheck, t: "Meta agendados", v: d.goalScheduled ? pct(d.scheduled, d.goalScheduled) : "—", s: d.goalScheduled ? `de ${nf.format(d.goalScheduled)}` : "meta desligada", bar: d.goalScheduled ? (d.scheduled / d.goalScheduled) * 100 : undefined },
    { k: "qualificados", I: CircleCheck, t: "Qualificados", v: nf.format(d.qualified), s: "no período" },
    { k: "agendados", I: CalendarCheck, t: "Agendados", v: nf.format(d.scheduled), s: "visitas marcadas" },
    { k: "taxa_qualif", I: Percent, t: "Taxa de qualificação", v: pct(d.qualified, d.contacts), s: "dos contatos" },
    { k: "taxa_agend", I: Percent, t: "Taxa de agendamento", v: pct(d.scheduled, d.contacts), s: "dos contatos" },
    { k: "tempo", I: Timer, t: "Tempo por lead", v: fmtDuration(d.avgSeconds), s: `mediana ${fmtDuration(d.medianSeconds)}` },
    { k: "novos", I: Database, t: "Leads novos", v: nf.format(d.stock.novos), s: "no estoque" },
  ];

  return (
    <div className="space-y-5">
      <PageHead icon={LayoutDashboard} title="Dashboard" subtitle={`${period.preset === "hoje" ? "Hoje" : period.preset === "custom" ? `${fmtDate(period.from)} a ${fmtDate(period.to)}` : `Últimos ${period.preset} dias`} · ${plural(scope.length, "pessoa", "pessoas")}`} />
      <div className={`${panelCls} p-4`}><Suspense fallback={null}>
        <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={team ? people : []} selected={scope} />
      </Suspense></div>

      {kpis.some((x) => can(`panel.kpi.${x.k}`)) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {kpis.filter((x) => can(`panel.kpi.${x.k}`)).map(({ I, t, v, s: sub, bar }) => (
            <div key={t} className={`${panelCls} relative overflow-hidden p-4 transition hover:border-accent/50 hover:shadow-md`}>
              <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{t}</p><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><I size={15} aria-hidden /></span></div>
              <p className="figure mt-2 text-3xl font-bold leading-none">{v}</p>
              <p className="mt-1.5 text-xs text-muted">{sub}</p>
              {bar !== undefined && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full ${bar >= 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${Math.min(100, bar)}%` }} /></div>}
            </div>
          ))}
        </div>
      )}

      <div className="panel-grid">
        {can("panel.ranking") && (
          <Block icon={Trophy} title="Ranking da equipe">
            {d.ranking.map((r) => <Bar key={r.id} label={r.name.split(" ")[0]} value={r.n} max={Math.max(1, settings.daily_goal * d.days)} color={bubbleHex(r.accent, r.id, r.roles)} right={`${r.n} · ${fmtDuration(r.avgSeconds)}`} />)}
          </Block>
        )}
        {can("panel.funil") && (
          <Block icon={FunnelIcon} title="Funil">
            <Bar label="Trabalhados" value={d.contacts} max={d.contacts} color="#888780" />
            <Bar label="Conversando" value={d.conversing} max={d.contacts} color={tagColor.conversando ?? "#378ADD"} right={`${d.conversing} · ${pct(d.conversing, d.contacts)}`} />
            <Bar label="Qualificados" value={d.qualified} max={d.contacts} color={tagColor.qualificado ?? "#1D9E75"} right={`${d.qualified} · ${pct(d.qualified, d.contacts)}`} />
            <Bar label="Agendados" value={d.scheduled} max={d.contacts} color={tagColor.agendado ?? "#7F77DD"} right={`${d.scheduled} · ${pct(d.scheduled, d.contacts)}`} />
          </Block>
        )}
      </div>

      {can("panel.horas") && (
        <Block icon={Clock} title="Atividade por hora">
          {hoursRange.length === 0 ? <p className="text-sm text-muted">Nenhuma atividade neste período ainda.</p> : <>
          <div className="flex h-28 items-end gap-1.5">
            {perHour.map(({ h, parts }) => {
              const total = parts.reduce((a, p) => a + p.n, 0);
              return (
                <div key={h} title={`${h}h: ${total}${parts.length > 1 ? " (" + parts.map((p) => `${p.name.split(" ")[0]} ${p.n}`).join(", ") + ")" : ""}`} className="flex flex-1 flex-col-reverse overflow-hidden rounded-t" style={{ height: `${Math.max(2, (total / maxHour) * 100)}%`, background: total ? undefined : "var(--line)" }}>
                  {parts.map((p) => <span key={p.uid} style={{ flex: p.n, background: p.hex }} />)}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1.5">{hoursRange.map((h) => <span key={h} className="flex-1 text-center text-[11px] text-muted">{h}h</span>)}</div></>}
          {d.ranking.length > 1 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">{d.ranking.map((r) => <span key={r.id} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: bubbleHex(r.accent, r.id, r.roles) }} />{r.name.split(" ")[0]}</span>)}</div>}
        </Block>
      )}

      <div className="panel-grid">
        {can("panel.meios") && (
          <Block icon={MessagesSquare} title="Meios de contato">
            {d.meios.length ? d.meios.map((m) => <Bar key={m.channel} label={m.label} value={m.n} max={d.meios[0].n} color={m.color} right={`${m.n} · ${pct(m.q, m.n)} qualif.`} />) : <p className="text-sm text-muted">Sem contatos no período.</p>}
          </Block>
        )}
        {(can("panel.temperatura") || can("panel.estoque")) && (
          <Block icon={Flame} title="Interesse e Leads">
            {can("panel.temperatura") && <><div className="mb-1 flex h-2.5 overflow-hidden rounded-full">{d.temp.map((t) => <span key={t.key} style={{ flex: t.n, background: t.color }} />)}</div><p className="mb-3 text-xs text-muted">{d.temp.map((t) => `${t.label} ${nf.format(t.n)}`).join(" · ")}</p></>}
            {can("panel.estoque") && <><div className="mb-1 flex h-2.5 overflow-hidden rounded-full"><span style={{ flex: d.stock.novos, background: "#888780" }} /><span style={{ flex: d.stock.trabalhados, background: "#378ADD" }} /><span style={{ flex: d.stock.fora, background: "#E24B4A" }} /><span style={{ flex: d.stock.clientes, background: "#1D9E75" }} /></div><p className="text-xs text-muted">{nf.format(d.stock.novos)} novos · {nf.format(d.stock.trabalhados)} trabalhados · {nf.format(d.stock.fora)} fora do sorteio · {nf.format(d.stock.clientes)} clientes ({pct(d.stock.novos, totalStock)} novos)</p></>}
          </Block>
        )}
      </div>

      <div className="panel-grid">
        {can("panel.alertas") && (
          <Block icon={AlertTriangle} title="Alertas">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Flame size={16} className="text-danger" aria-hidden /><span className="flex-1">{d.alerts.hot === 1 ? "1 lead quente sem contato" : `${nf.format(d.alerts.hot)} leads quentes sem contato`} há mais de 3 dias</span><Link className="underline" href="/leads?tag=temperatura:quente">Ver</Link></li>
              {d.alerts.pendingVisits > 0 && <li className="flex items-center gap-2"><CalendarCheck size={16} className="text-warn" aria-hidden /><span className="flex-1">{plural(d.alerts.pendingVisits, "visita aguardando", "visitas aguardando")} confirmação do representante há mais de 3 dias</span><Link href="/visitas" className="text-xs underline">ver</Link></li>}
              <li className="flex items-center gap-2"><Database size={16} aria-hidden /><span className="flex-1">{plural(d.alerts.noInfo, "lead ainda sem", "leads ainda sem")} consulta de CNPJ</span></li>
            </ul>
          </Block>
        )}
        {can("panel.agendamentos") && (
          <Block icon={CalendarCheck} title="Agendamentos recentes">
            {d.recentVisits.length ? <ul className="space-y-1.5 text-sm">{d.recentVisits.map((v) => <li key={v.code + v.at} className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-sunk px-2 py-0.5 text-xs">{v.code}</span><span className="min-w-0 flex-1 truncate">{v.company}</span><span className="flex items-center gap-2 text-xs text-muted">{v.name && <PersonBubble name={v.name} hex={bubbleHex(v.accent, v.uid ?? 0, v.roles ?? undefined)} />}{fmtDateTime(v.at)}</span></li>)}</ul> : <p className="text-sm text-muted">Nenhuma visita agendada ainda.</p>}
          </Block>
        )}
      </div>
      {teamSales && (
        <section className="space-y-3">
          <h2 className="display text-2xl">Vendas da equipe</h2>
          <SalesDashboard s={teamSales} showRanking />
        </section>
      )}
    </div>
  );
}
