import { metricUsers } from "@/modules/auth/visibility";
import { PersonBubble } from "@/components/person-bubble";
import { plural } from "@/lib/format";
import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { AlertTriangle, LayoutDashboard, CalendarCheck, Clock, Database, Flame, MessagesSquare, Percent, Timer, Target, Trophy, Filter as FunnelIcon, PhoneCall, CircleCheck, Phone, Handshake, Ban, CalendarClock, Flag, Hourglass, SkipForward, Square, TrendingDown, TrendingUp, Wallet, Zap } from "lucide-react";
import { Suspense } from "react";
import { DashBlock, DashSection, MetricCard } from "@/components/dash-ui";
import { DashHero } from "@/components/dash-hero";
import { getHero } from "@/modules/dashboard/hero";
import { DashTabs } from "@/components/dash-tabs";
import { DashboardFilters } from "@/components/dashboard-filters";
import { panelCls } from "@/components/ui";
import { VisitCodeChip } from "@/components/visit-row";
import { bubbleHex } from "@/config/theme";
import { SalesDashboard } from "@/components/deals/sales-dashboard";
import { hasSellerPart, isSellerOnly } from "@/config/roles";
import { db, tags, users } from "@/db";
import { getSalesStats } from "@/modules/deals/stats";
import { sql } from "drizzle-orm";
import { fmtDate, fmtDateTime, fmtDuration } from "@/lib/format";
import { fmtBRL } from "@/config/deals";
import { requirePerm } from "@/modules/auth/guard";
import { getDashboard, getDashboardExtra, periodDays, resolvePeriod } from "@/modules/dashboard/stats";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";
const nf = new Intl.NumberFormat("pt-BR");
/** Diferença para o período anterior de mesmo tamanho. */
const vs = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? " · novo" : "") : ` · ${cur >= prev ? "▲" : "▼"} ${Math.abs(Math.round(((cur - prev) / prev) * 100))}% vs. anterior`);
const pct = (a: number, b: number) => (b ? `${Math.min(100, Math.round((a / b) * 100))}%` : "0%");

function Bar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-3 text-sm last:mb-0">
      <span className="w-20 shrink-0 truncate text-muted sm:w-24">{label}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${max ? Math.max(value ? 3 : 0, Math.round((value / max) * 100)) : 0}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, white), ${color})` }} /></span>
      <span className="figure min-w-24 shrink-0 whitespace-nowrap text-right text-xs font-medium">{right ?? nf.format(value)}</span>
    </div>
  );
}
const TONES = { danger: "var(--danger)", warn: "var(--warn)", info: "var(--accent)", ok: "var(--ok)" } as const;
/** Cartão de alerta: número grande, texto curto e atalho. Fica calmo (verde) quando não há pendência. */
function AlertTile({ icon: I, tone, n, text, hint, href }: { icon: typeof Clock; tone: keyof typeof TONES; n: number; text: string; hint: string; href?: string }) {
  const c = n > 0 ? TONES[tone] : TONES.ok;
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }}><I size={19} aria-hidden /></span>
      <span className="figure min-w-[5.5rem] text-3xl leading-none" style={{ color: n > 0 ? c : undefined }}>{nf.format(n)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{n > 0 ? text : "Tudo em dia"}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-xl border border-line/60 bg-sunk/40 p-3.5 transition";
  return href && n > 0
    ? <Link href={href} className={`${cls} hover:-translate-y-0.5 hover:border-accent/50 hover:bg-sunk/70`} style={{ borderLeft: `3px solid ${c}` }}>{body}</Link>
    : <div className={cls} style={{ borderLeft: `3px solid ${c}` }}>{body}</div>;
}
const BLOCK_HEX: Record<string, string> = { "Ranking da equipe": "#F5B301", Funil: "#7F77DD", "Resultado dos atendimentos": "#1D9E75", "Evolução por dia": "#378ADD", "Atividade por hora": "#f59e0b", "Meios de contato": "#22c55e", "Interesse e Leads": "#f97316", Alertas: "#E24B4A", "Agendamentos recentes": "#ec4899" };
const Block = ({ icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) => <DashBlock I={icon} title={title} hex={BLOCK_HEX[title] ?? "var(--accent)"}>{children}</DashBlock>;
/** Anel de progresso (metas). */
function Ring({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value)); const r = 22; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="size-14 shrink-0 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--sunk)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-1000" />
    </svg>
  );
}
const KPI_HEX: Record<string, string> = { aproveitamento: "#1D9E75", melhor_dia: "#F5B301", leads_tocados: "#378ADD", toques_lead: "#7F77DD", multicanal: "#f97316", maior_ligacao: "#0ea5e9", lig_caixa_postal: "#64748b", lig_pessoa: "#22c55e", zap_enviados: "#22c55e", zap_resposta: "#16a34a", email_enviados: "#378ADD", email_resposta: "#2563eb", email_voltou: "#ef4444", sem_resultado: "#f59e0b", lig_atendidas: "#22c55e", taxa_atendimento: "#14b8a6", tempo_conversa: "#f59e0b", lig_sem_resposta: "#94a3b8", numeros_errados: "#ef4444", contatos: "#378ADD", meta: "#1D9E75", meta_agend: "#7F77DD", meta_ligacoes: "#0ea5e9", meta_convertidos: "#22c55e", qualificados: "#1D9E75", agendados: "#7F77DD", taxa_qualif: "#14b8a6", taxa_agend: "#a855f7", tempo: "#f59e0b", media_dia: "#eab308", ligacoes: "#0ea5e9", convertidos: "#22c55e", descartados: "#E24B4A", visitas_ok: "#ec4899", tempo_total: "#BA7517", vendas_origem: "#10b981", sequencia: "#f97316", novos: "#64748b" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.painel");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const dflt = (await getSettings()).dash_default_days;
  const period = resolvePeriod({ p: one("p") ?? (one("from") || one("to") ? undefined : dflt === 30 ? "30" : dflt === 7 ? "7" : undefined), from: iso("from"), to: iso("to") });
  const team = !!me.permissions["panel.equipe"];
  const hero = await getHero(me);

  if (isSellerOnly(me.roles)) {
    const stats = await getSalesStats(period, [me.id]);
    return (
      <div className="space-y-5">
        <PageHead icon={LayoutDashboard} title="Dashboard" subtitle={`Suas vendas · ${period.preset === "hoje" ? "Hoje" : period.preset === "custom" ? `${fmtDate(period.from)} a ${fmtDate(period.to)}` : `Últimos ${period.preset} dias`}`} />
        <DashHero name={me.name} h={hero} />
        <div><Suspense fallback={null}>
          <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={[]} selected={[me.id]} />
        </Suspense></div>
        <SalesDashboard s={stats} showRanking={false} />
      </div>
    );
  }

  const all = await db.select().from(users).where(and(eq(users.active, true), eq(users.inMetrics, true))).orderBy(asc(users.name));
  const people = all.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles) }));
  const sdrIds = new Set(all.filter((u) => !(u.roles.length === 1 && u.roles[0] === "seller")).map((u) => u.id));
  const sellerIds = new Set(all.filter((u) => u.roles.includes("seller")).map((u) => u.id));
  const picked = (Array.isArray(sp.u) ? sp.u : sp.u ? [sp.u] : []).map(Number).filter((id) => people.some((p) => p.id === id));
  /** `scope` = quem aparece como selecionado; `sdrScope` = só quem tem parte SDR (números de atendimento). */
  const scope = team ? (picked.length ? picked : people.map((p) => p.id)) : [me.id];
  const sdrScope = team ? (picked.length ? picked.filter((id) => sdrIds.has(id)) : [...sdrIds]) : [me.id];
  const sdrQuery = sdrScope.length ? sdrScope : [-1];
  const tagColor = Object.fromEntries((await db.select({ key: tags.key, color: tags.color }).from(tags)).map((t) => [t.key, t.color]));
  const settings = await getSettings();
  const [d, x] = await Promise.all([getDashboard(period, sdrQuery, settings), getDashboardExtra(period, sdrQuery)]);
  const can = (k: string) => !!me.permissions[k];
  // Só do primeiro ao último horário com registro; horas vazias no meio (almoço) continuam aparecendo.
  const activeHours = d.hours.map((x) => x.h);
  const hoursRange = activeHours.length ? Array.from({ length: Math.max(...activeHours) - Math.min(...activeHours) + 1 }, (_, i) => Math.min(...activeHours) + i) : [];
  const colorOf = new Map(d.ranking.map((r) => [r.id, { hex: bubbleHex(r.accent, r.id, r.roles), name: r.name }]));
  const perHour = hoursRange.map((h) => ({ h, parts: d.hours.filter((x) => x.h === h).map((x) => ({ ...x, ...(colorOf.get(x.uid) ?? { hex: "#888780", name: "?" }) })) }));
  const maxHour = Math.max(1, ...perHour.map((x) => x.parts.reduce((a, p) => a + p.n, 0)));
  const sellersAll = can("panel.vendas") ? await db.select({ id: users.id }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, metricUsers(me))) : [];
  const salesIds = team && picked.length ? sellersAll.map((x) => x.id).filter((id) => picked.includes(id)) : sellersAll.map((x) => x.id);
  const teamSales = can("panel.vendas") ? await getSalesStats(period, salesIds) : null;
  /** Cargos se somam: quem é SDR e Vendedor vê também as próprias vendas (a da equipe já inclui a dele). */
  const mySales = hasSellerPart(me.roles) && !teamSales ? await getSalesStats(period, [me.id]) : null;
  const totalStock = d.stock.novos + d.stock.trabalhados + d.stock.fora + d.stock.clientes || 1;

  const hourTotals = hoursRange.map((h) => ({ h, n: d.hours.filter((q) => q.h === h).reduce((a, q) => a + q.n, 0) }));
  const bestHour = hourTotals.length ? hourTotals.reduce((a, b) => (b.n > a.n ? b : a)).h : null;
  const t = x.touch;
  const resolved = t.callsAnswered + t.callsNoAnswer + t.callsWrong;
  const bestDay = x.daily.length ? x.daily.reduce((m, q) => (q.n > m.n ? q : m), x.daily[0]) : null;
  const closedSessions = x.saved + x.skipped + x.released + x.discarded + x.abandoned;
  const mmss = (sec: number) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")} min` : "—");
  type Kpi = { k: string; g: string; I: typeof Clock; t: string; v: string; s: string; bar?: number; featured?: boolean };
  const kpis: Kpi[] = [
    { k: "contatos", g: "atend", featured: true, I: PhoneCall, t: "Contatos", v: nf.format(d.contacts), s: `${plural(d.days, "dia", "dias")}${vs(d.contacts, x.prev.contacts)}` },
    { k: "meta", g: "atend", featured: true, I: Target, t: "Meta atendidos", v: d.goal ? pct(d.contacts, d.goal) : "—", s: d.goal ? `${nf.format(d.contacts)} de ${nf.format(d.goal)}` : "meta desligada", bar: d.goal ? (d.contacts / d.goal) * 100 : undefined },
    { k: "meta_agend", g: "atend", featured: true, I: CalendarCheck, t: "Meta agendados", v: d.goalScheduled ? pct(d.scheduled, d.goalScheduled) : "—", s: d.goalScheduled ? `${nf.format(d.scheduled)} de ${nf.format(d.goalScheduled)}` : "meta desligada", bar: d.goalScheduled ? (d.scheduled / d.goalScheduled) * 100 : undefined },
    ...(d.goalCalls ? [{ k: "meta_ligacoes", g: "atend", I: Phone, t: "Meta ligações", v: pct(d.calls, d.goalCalls), s: `${nf.format(d.calls)} de ${nf.format(d.goalCalls)}`, bar: (d.calls / d.goalCalls) * 100 }] : []),
    ...(d.goalConverted ? [{ k: "meta_convertidos", g: "atend", I: Handshake, t: "Meta convertidos", v: pct(d.converted, d.goalConverted), s: `${nf.format(d.converted)} de ${nf.format(d.goalConverted)}`, bar: (d.converted / d.goalConverted) * 100 }] : []),
    { k: "qualificados", g: "atend", I: CircleCheck, t: "Qualificados", v: nf.format(d.qualified), s: `no período${vs(d.qualified, x.prev.qualified)}` },
    { k: "agendados", g: "atend", I: CalendarCheck, t: "Agendados", v: nf.format(d.scheduled), s: `visitas marcadas${vs(d.scheduled, x.prev.scheduled)}` },
    { k: "convertidos", g: "atend", I: Handshake, t: "Convertidos", v: nf.format(d.converted), s: "repassados aos vendedores" },
    { k: "taxa_qualif", g: "atend", I: Percent, t: "Taxa de qualificação", v: pct(d.qualified, d.contacts), s: "dos contatos", bar: d.contacts ? (d.qualified / d.contacts) * 100 : 0 },
    { k: "taxa_agend", g: "atend", I: Percent, t: "Taxa de agendamento", v: pct(d.scheduled, d.contacts), s: "dos contatos", bar: d.contacts ? (d.scheduled / d.contacts) * 100 : 0 },
    { k: "aproveitamento", g: "atend", I: Zap, t: "Aproveitamento", v: pct(x.saved, closedSessions), s: `${nf.format(x.saved)} salvos de ${nf.format(closedSessions)} sorteados`, bar: closedSessions ? (x.saved / closedSessions) * 100 : 0 },
    { k: "descartados", g: "atend", I: Ban, t: "Descartados", v: nf.format(x.discarded), s: "leads tirados da lista" },
    { k: "tempo", g: "ritmo", I: Timer, t: "Tempo por lead", v: fmtDuration(d.avgSeconds), s: `mediana ${fmtDuration(d.medianSeconds)}` },
    { k: "tempo_total", g: "ritmo", I: Hourglass, t: "Tempo atendendo", v: fmtDuration(x.totalSeconds), s: "somando todos os leads" },
    { k: "media_dia", g: "ritmo", I: Zap, t: "Média por dia", v: (d.contacts / Math.max(1, d.days)).toLocaleString("pt-BR", { maximumFractionDigits: 1 }), s: bestHour ? `pico às ${bestHour}h` : "contatos por dia" },
    { k: "melhor_dia", g: "ritmo", I: Trophy, t: "Melhor dia", v: bestDay && bestDay.n ? nf.format(bestDay.n) : "—", s: bestDay && bestDay.n ? `atendimentos em ${fmtDate(bestDay.d)}` : "sem atendimentos no período" },
    { k: "sequencia", g: "ritmo", I: Flag, t: "Sequência", v: nf.format(x.streak), s: x.streak === 1 ? "dia seguido atendendo" : "dias seguidos atendendo" },
    { k: "leads_tocados", g: "ritmo", I: Database, t: "Leads contatados", v: nf.format(t.leads), s: "diferentes, por ligação, WhatsApp ou e-mail" },
    { k: "toques_lead", g: "ritmo", I: MessagesSquare, t: "Contatos por lead", v: t.touchesPerLead ? t.touchesPerLead.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—", s: "tentativas médias em cada lead" },
    { k: "multicanal", g: "ritmo", I: Flame, t: "Lead em 2+ meios", v: nf.format(t.multiChannel), s: "abordados por mais de um canal" },
    { k: "ligacoes", g: "lig", featured: true, I: Phone, t: "Ligações", v: nf.format(d.calls), s: `${pct(d.calls, d.contacts)} dos contatos` },
    { k: "lig_atendidas", g: "lig", I: PhoneCall, t: "Ligações atendidas", v: nf.format(t.callsAnswered), s: `${nf.format(t.callsTalked)} falaram · ${nf.format(t.callsMessage)} recado` },
    { k: "taxa_atendimento", g: "lig", I: Percent, t: "Taxa de atendimento", v: pct(t.callsAnswered, resolved), s: `de ${nf.format(resolved)} ligações com resultado`, bar: resolved ? (t.callsAnswered / resolved) * 100 : 0 },
    { k: "tempo_conversa", g: "lig", I: Hourglass, t: "Tempo de conversa", v: fmtDuration(t.talkSeconds), s: t.avgTalkSeconds ? `média ${mmss(t.avgTalkSeconds)} por ligação` : "somando as ligações atendidas" },
    { k: "maior_ligacao", g: "lig", I: Timer, t: "Maior ligação", v: t.longestCall ? mmss(t.longestCall) : "—", s: "a conversa mais longa do período" },
    { k: "lig_sem_resposta", g: "lig", I: Phone, t: "Ligações sem resposta", v: nf.format(t.callsNoAnswer), s: "não atendeu, caixa postal ou ocupado" },
    { k: "lig_caixa_postal", g: "lig", I: MessagesSquare, t: "Caixa postal", v: nf.format(t.callsVoicemail), s: "cairam na caixa postal" },
    { k: "numeros_errados", g: "lig", I: Ban, t: "Números errados", v: nf.format(t.callsWrong), s: "marcados como inválidos na ligação" },
    { k: "lig_pessoa", g: "lig", I: CircleCheck, t: "Falou com pessoa certa", v: nf.format(t.withPerson), s: "contatos com a pessoa identificada" },
    { k: "zap_enviados", g: "msg", featured: true, I: MessagesSquare, t: "WhatsApp enviados", v: nf.format(t.waSent), s: `${nf.format(t.waReplied)} responderam` },
    { k: "zap_resposta", g: "msg", I: Percent, t: "Resposta no WhatsApp", v: pct(t.waReplied, t.waSent), s: `${nf.format(t.waSilent)} sem resposta · ${nf.format(t.waNone)} sem WhatsApp`, bar: t.waSent ? (t.waReplied / t.waSent) * 100 : 0 },
    { k: "email_enviados", g: "msg", featured: true, I: PhoneCall, t: "E-mails enviados", v: nf.format(t.emSent), s: `${nf.format(t.emReplied)} responderam` },
    { k: "email_resposta", g: "msg", I: Percent, t: "Resposta no e-mail", v: pct(t.emReplied, t.emSent), s: `${nf.format(t.emOpened)} abertos · ${nf.format(t.emBounced)} voltaram`, bar: t.emSent ? (t.emReplied / t.emSent) * 100 : 0 },
    { k: "email_voltou", g: "msg", I: Ban, t: "E-mails que voltaram", v: nf.format(t.emBounced), s: "marcados como inválidos" },
    { k: "sem_resultado", g: "msg", I: AlertTriangle, t: "Contatos sem resultado", v: nf.format(t.pending), s: t.pending ? "falta dizer como foi" : "tudo registrado" },
    { k: "visitas_ok", g: "res", I: CalendarClock, t: "Visitas confirmadas", v: nf.format(x.visitsConfirmed + x.visitsDone), s: `${nf.format(x.visitsDone)} realizadas · ${nf.format(x.visitsPending)} aguardando` },
    { k: "vendas_origem", g: "res", I: Wallet, t: "Vendas originadas", v: nf.format(x.originated), s: x.originatedValue ? fmtBRL(x.originatedValue) : "negociações faturadas" },
    { k: "novos", g: "res", I: Database, t: "Leads novos", v: nf.format(d.stock.novos), s: "no estoque" },
  ];
  const GROUPS: [string, string, string, typeof Clock, string][] = [
    ["atend", "Atendimento", "metas, qualificação e agendamentos", Target, "#378ADD"],
    ["ritmo", "Ritmo e tempo", "quanto e com que constância você atende", Zap, "#f59e0b"],
    ["lig", "Ligações", "atendimento, conversa e números ruins", Phone, "#0ea5e9"],
    ["msg", "WhatsApp e e-mail", "envios e respostas", MessagesSquare, "#22c55e"],
    ["res", "Resultados", "visitas, vendas e estoque", Wallet, "#ec4899"],
  ];

  return (
    <div className="space-y-5">
      <PageHead icon={LayoutDashboard} title="Dashboard" subtitle={`${period.preset === "hoje" ? "Hoje" : period.preset === "custom" ? `${fmtDate(period.from)} a ${fmtDate(period.to)}` : `Últimos ${period.preset} dias`} · ${plural(scope.length, "pessoa", "pessoas")}`} />
      <DashHero name={me.name} h={hero} />
      <div><Suspense fallback={null}>
        <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={team ? people : []} selected={scope} />
      </Suspense></div>

      <DashTabs
        sdr={<>
      {GROUPS.map(([g, title, hint, GI, ghex]) => {
        const list = kpis.filter((q) => q.g === g && can(`panel.kpi.${q.k}`));
        if (!list.length) return null;
        return (
          <DashSection key={g} I={GI} title={title} hint={hint} hex={ghex}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {list.map(({ k, I, t: kt, v, s: sub, bar, featured }, i) => <MetricCard key={k} i={i} I={I} t={kt} v={v} s={sub} bar={bar} featured={featured} hex={KPI_HEX[k] ?? ghex} />)}
            </div>
          </DashSection>
        );
      })}

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

      <div className="panel-grid">
        {can("panel.funil") && (
          <Block icon={Flag} title="Resultado dos atendimentos">
            {(() => { const rows = [["Salvos", x.saved, "#1D9E75"], ["Pulados", x.skipped, "#888780"], ["Parados", x.released, "#378ADD"], ["Descartados", x.discarded, "#E24B4A"], ["Abandonados", x.abandoned, "#BA7517"]] as const; const max = Math.max(1, ...rows.map((r) => r[1])); return rows.map(([l, v, c]) => <Bar key={l} label={l} value={v} max={max} color={c} right={`${v}`} />); })()}
          </Block>
        )}
        {can("panel.horas") && (
          <Block icon={x.prev.contacts <= d.contacts ? TrendingUp : TrendingDown} title="Evolução por dia">
            {x.daily.length < 2 ? <p className="text-sm text-muted">Escolha 7 ou 30 dias para ver a evolução.</p> : <>
              <div className="flex h-36 items-end gap-1 border-b border-line">
                {x.daily.map((p) => <div key={p.d} title={`${fmtDate(p.d)}: ${p.n}`} className="flex-1 rounded-t-md bg-grad transition hover:brightness-110" style={{ height: `${Math.max(3, (p.n / Math.max(1, ...x.daily.map((q) => q.n))) * 100)}%`, opacity: p.n ? 1 : 0.25 }} />)}
              </div>
              <p className="mt-2 text-xs text-muted">{fmtDate(x.daily[0].d)} a {fmtDate(x.daily[x.daily.length - 1].d)} · melhor dia: <b className="figure text-ink">{Math.max(...x.daily.map((q) => q.n))}</b> atendimentos{vs(d.contacts, x.prev.contacts)}</p>
            </>}
          </Block>
        )}
      </div>

      {can("panel.horas") && (
        <Block icon={Clock} title="Atividade por hora">
          {hoursRange.length === 0 ? <p className="text-sm text-muted">Nenhuma atividade neste período ainda.</p> : <>
          <div className="flex h-36 items-end gap-1.5 border-b border-line">
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
            <div className="grid gap-2.5">
              <AlertTile icon={Flame} tone="danger" n={d.alerts.hot} text={d.alerts.hot === 1 ? "lead quente sem contato" : "leads quentes sem contato"} hint="há mais de 3 dias" href="/leads?tag=temperatura:quente" />
              <AlertTile icon={CalendarCheck} tone="warn" n={d.alerts.pendingVisits} text={d.alerts.pendingVisits === 1 ? "visita sem confirmação" : "visitas sem confirmação"} hint="do representante, há mais de 3 dias" href="/visitas" />
              <AlertTile icon={Database} tone="info" n={d.alerts.noInfo} text={d.alerts.noInfo === 1 ? "lead sem consulta de CNPJ" : "leads sem consulta de CNPJ"} hint="dados da empresa pendentes" />
            </div>
          </Block>
        )}
        {can("panel.agendamentos") && (
          <Block icon={CalendarCheck} title="Agendamentos recentes">
            {d.recentVisits.length ? <ul className="space-y-1.5 text-sm">{d.recentVisits.map((v) => <li key={v.id}><Link href={`/visitas?v=${v.id}`} className="flex flex-wrap items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-sunk/60"><VisitCodeChip code={v.code} /><span className="min-w-0 flex-1 truncate">{v.company}</span><span className="flex items-center gap-2 text-xs text-muted">{v.name && <PersonBubble name={v.name} hex={bubbleHex(v.accent, v.uid ?? 0, v.roles ?? undefined)} />}{fmtDateTime(v.at)}</span></Link></li>)}</ul> : <p className="text-sm text-muted">Nenhuma visita agendada ainda.</p>}
          </Block>
        )}
      </div>
        </>}
        sales={mySales || teamSales ? <>
      {mySales && (
        <section className="space-y-3">
          <h2 className="display text-2xl">Minhas vendas</h2>
          <SalesDashboard s={mySales} showRanking={false} />
        </section>
      )}
      {teamSales && (
        <section className="space-y-3">
          <h2 className="display text-2xl">Vendas da equipe</h2>
          <SalesDashboard s={teamSales} showRanking />
        </section>
      )}
        </> : null}
      />
    </div>
  );
}
