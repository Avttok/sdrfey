import { plural } from "@/lib/format";
import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, Clock, Database, Flame, MessagesSquare, Percent, Timer, Target, Trophy, Filter as FunnelIcon, PhoneCall, CircleCheck } from "lucide-react";
import { Suspense } from "react";
import { DashboardFilters } from "@/components/dashboard-filters";
import { panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import { db, tags, users } from "@/db";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { requirePerm } from "@/modules/auth/guard";
import { getDashboard, resolvePeriod } from "@/modules/dashboard/stats";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";
const nf = new Intl.NumberFormat("pt-BR");
const pct = (a: number, b: number) => (b ? `${Math.min(100, Math.round((a / b) * 100))}%` : "0%");

function Bar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 truncate text-muted">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%`, background: color }} /></span>
      <span className="figure w-20 text-right text-xs">{right ?? nf.format(value)}</span>
    </div>
  );
}
const Block = ({ icon: I, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) => (
  <section className={`${panelCls} p-4`}><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><I size={16} aria-hidden /> {title}</h2>{children}</section>
);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.painel");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const period = resolvePeriod({ p: one("p"), from: iso("from"), to: iso("to") });
  const team = !!me.permissions["panel.equipe"];

  const all = await db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true))).orderBy(asc(users.name));
  const people = all.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles) }));
  const picked = (Array.isArray(sp.u) ? sp.u : sp.u ? [sp.u] : []).map(Number).filter((id) => people.some((p) => p.id === id));
  const scope = team ? (picked.length ? picked : people.map((p) => p.id)) : [me.id];
  const tagColor = Object.fromEntries((await db.select({ key: tags.key, color: tags.color }).from(tags)).map((t) => [t.key, t.color]));
  const settings = await getSettings();
  const d = await getDashboard(period, scope, settings.daily_goal);
  const can = (k: string) => !!me.permissions[k];
  const maxHour = Math.max(1, ...d.hours.map((h) => h.n));
  const hoursRange = Array.from({ length: 14 }, (_, i) => 7 + i);
  const totalStock = d.stock.novos + d.stock.trabalhados + d.stock.fora + d.stock.clientes || 1;

  const kpis = [
    { k: "contatos", I: PhoneCall, t: "Contatos", v: nf.format(d.contacts), s: plural(d.days, "dia", "dias") },
    { k: "meta", I: Target, t: "Meta atingida", v: pct(d.contacts, d.goal), s: `de ${nf.format(d.goal)}` },
    { k: "qualificados", I: CircleCheck, t: "Qualificados", v: nf.format(d.qualified), s: "no período" },
    { k: "agendados", I: CalendarCheck, t: "Agendados", v: nf.format(d.scheduled), s: "visitas marcadas" },
    { k: "taxa_qualif", I: Percent, t: "Taxa de qualificação", v: pct(d.qualified, d.contacts), s: "dos contatos" },
    { k: "taxa_agend", I: Percent, t: "Taxa de agendamento", v: pct(d.scheduled, d.contacts), s: "dos contatos" },
    { k: "tempo", I: Timer, t: "Tempo por lead", v: fmtDuration(d.avgSeconds), s: `mediana ${fmtDuration(d.medianSeconds)}` },
    { k: "novos", I: Database, t: "Leads novos", v: nf.format(d.stock.novos), s: "no estoque" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">Dashboard</h1>
      <Suspense fallback={null}>
        <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={team ? people : []} selected={scope} />
      </Suspense>

      {kpis.some((x) => can(`panel.kpi.${x.k}`)) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.filter((x) => can(`panel.kpi.${x.k}`)).map(({ I, t, v, s }) => (
            <div key={t} className={`${panelCls} p-4`}><p className="flex items-center gap-1.5 text-xs text-muted"><I size={14} aria-hidden /> {t}</p><p className="figure mt-1 text-3xl">{v}</p><p className="text-xs text-muted">{s}</p></div>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
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
        <Block icon={Clock} title="Atividade por hora (Brasília)">
          <div className="flex h-24 items-end gap-1.5">{hoursRange.map((h) => { const n = d.hours.find((x) => x.h === h)?.n ?? 0; return <span key={h} title={`${h}h: ${n}`} className="flex-1 rounded-t bg-accent/80" style={{ height: `${Math.max(2, (n / maxHour) * 100)}%` }} />; })}</div>
          <div className="mt-1 flex gap-1.5">{hoursRange.map((h) => <span key={h} className="flex-1 text-center text-[11px] text-muted">{h}h</span>)}</div>
        </Block>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
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

      <div className="grid gap-3 lg:grid-cols-2">
        {can("panel.alertas") && (
          <Block icon={AlertTriangle} title="Alertas">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Flame size={16} className="text-danger" aria-hidden /><span className="flex-1">{d.alerts.hot === 1 ? "1 lead quente sem contato" : `${nf.format(d.alerts.hot)} leads quentes sem contato`} há mais de 3 dias</span><Link className="underline" href="/leads?tag=temperatura:quente">Ver</Link></li>
              <li className="flex items-center gap-2"><Database size={16} aria-hidden /><span className="flex-1">{plural(d.alerts.noInfo, "lead ainda sem", "leads ainda sem")} consulta de CNPJ</span></li>
            </ul>
          </Block>
        )}
        {can("panel.agendamentos") && (
          <Block icon={CalendarCheck} title="Agendamentos recentes">
            {d.recentVisits.length ? <ul className="space-y-1.5 text-sm">{d.recentVisits.map((v) => <li key={v.code + v.at} className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-sunk px-2 py-0.5 text-xs">{v.code}</span><span className="min-w-0 flex-1 truncate">{v.company}</span><span className="text-xs text-muted">{v.name?.split(" ")[0]} · {fmtDateTime(v.at)}</span></li>)}</ul> : <p className="text-sm text-muted">Nenhuma visita agendada ainda.</p>}
          </Block>
        )}
      </div>
    </div>
  );
}
