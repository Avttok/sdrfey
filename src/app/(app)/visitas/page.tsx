import { visibleUsers } from "@/modules/auth/visibility";
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { EoxIcon, SalesforceIcon } from "@/components/brand-icons";
import { CalendarCheck, CalendarClock, CalendarX2, CheckCircle2, Hourglass } from "lucide-react";
import { Suspense } from "react";
import { DashboardFilters } from "@/components/dashboard-filters";
import { VisitCards } from "@/components/visit-cards";
import { PageHead } from "@/components/page-head";
import { PersonBubble } from "@/components/person-bubble";
import { panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import type { Role } from "@/config/roles";
import { db, users } from "@/db";
import { dayEnd, dayStart, fmtDate, fmtDateTime, plural } from "@/lib/format";
import { hasSellerPart } from "@/config/roles";
import { requirePerm } from "@/modules/auth/guard";
import { resolvePeriod } from "@/modules/dashboard/stats";

export const metadata: Metadata = { title: "Visitas" };
export const dynamic = "force-dynamic";

type Row = { cnpj: string | null; phones: string[] | null; email: string | null; contact_name: string | null; role_title: string | null; owner_id: number | null; status: "pendente" | "confirmada" | "realizada" | "cancelada"; link: string | null; rep_name: string | null; rep_sap: string | null; rep_city: string | null; rep_km: number | null; kind: "rep" | "seller"; seller_name: string | null; sf_url: string | null; eox_url: string | null; confirmed_at: Date | null; visit_date: string | null; id: number; code: string; at: Date; note: string | null; canceled_at: Date | null; lead_id: number; company: string; city: string | null; uf: string | null; uid: number | null; name: string | null; accent: string | null; roles: Role[] | null };

/** Todas as visitas agendadas. Cada pessoa vê as suas; quem tem a permissão vê as da equipe. */
export default async function VisitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.visitas");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const period = resolvePeriod({ p: one("p") ?? (one("from") || one("to") ? undefined : "30"), from: iso("from"), to: iso("to") });
  const COLS = sql.raw(`select v.id, v.visit_date::text as visit_date, v.link, v.rep_name, v.rep_sap, v.rep_city, v.rep_km, v.kind, (select name from users su where su.id = v.seller_id) as seller_name, v.code, v.created_at as at, v.note, v.canceled_at, v.confirmed_at, v.status, l.id as lead_id, l.company, l.city, l.uf, l.salesforce_url as sf_url, l.eox_url, l.cnpj, l.phones, l.email, l.contact_name, l.role_title, v.user_id as owner_id, u.id as uid, u.name, u.accent, u.roles`); // texto fixo (sem entrada do usuário)
  const team = !!me.permissions["visits.team"];

  const all = await db.select().from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name));
  const people = all.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles) }));
  const picked = (Array.isArray(sp.u) ? sp.u : sp.u ? [sp.u] : []).map(Number).filter((id) => people.some((p) => p.id === id));
  const scope = team ? (picked.length ? picked : null) : [me.id];

  const from = dayStart(period.from).toISOString();
  const to = dayEnd(period.to).toISOString();
  const who = scope ? sql`and v.user_id in (${sql.join(scope.map((i) => sql`${i}`), sql`, `)})` : sql``;
  const rows = await db.execute<Row>(sql`
    ${COLS}
    from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.user_id
    where not l.is_test and v.created_at between ${from}::timestamptz and ${to}::timestamptz ${who}
    order by v.created_at desc limit 500`);
  const list = [...rows];
  // vindo do painel: a visita pedida abre mesmo fora do período/filtro, se a pessoa pode vê-la
  const wanted = Number(one("v")) || null;
  if (wanted && !list.some((r) => r.id === wanted)) {
    const extra = await db.execute<Row>(sql`
      ${COLS}
      from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.user_id
      where v.id = ${wanted} and not l.is_test ${who} limit 1`);
    if (extra[0]) list.unshift(extra[0]);
  }
  const active = list.filter((v) => !v.canceled_at);
  const canceled = list.length - active.length;
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).setHours(12, 0, 0, 0);
  const soon = active.filter((v) => { if (!v.visit_date || v.status === "realizada") return false; const d = Math.round((new Date(`${v.visit_date}T12:00:00`).getTime() - today) / 86_400_000); return d === 0 || d === 1; }).length;

  return (
    <div className="space-y-5">
      <PageHead icon={CalendarCheck} title="Visitas" subtitle={`${team ? "Equipe" : "Suas visitas"} · ${plural(active.length, "visita agendada", "visitas agendadas")}${canceled ? ` · ${plural(canceled, "cancelada", "canceladas")}` : ""} · ${period.from === period.to ? fmtDate(period.from) : `${fmtDate(period.from)} a ${fmtDate(period.to)}`}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["Agendadas", active.length, CalendarCheck, "text-accent"], ["Hoje e amanhã", soon, CalendarClock, "text-accent"], ["Aguardando confirmação", active.filter((v) => v.status === "pendente").length, Hourglass, "text-warn"], ["Realizadas", active.filter((v) => v.status === "realizada").length, CheckCircle2, "text-ok"]] as const).map(([l, n, I, c], i) => (
          <div key={l} style={{ "--i": i } as React.CSSProperties} className={`${panelCls} stat-glow card-in flex items-center gap-3 p-4`}>
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-grad-soft ${c}`}><I size={19} aria-hidden /></span>
            <div className="min-w-0"><p className="truncate text-xs text-muted">{l}</p><p className="figure text-2xl font-bold leading-tight">{n}</p></div>
          </div>
        ))}
      </div>
      <div className={`${panelCls} p-4`}><Suspense fallback={null}>
        <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={team ? people : []} selected={scope ?? []} />
      </Suspense></div>

      {list.length === 0 ? (
        <div className={`${panelCls} grid place-items-center gap-2 p-12 text-center`}>
          <span className="grid size-14 place-items-center rounded-2xl bg-grad-soft text-accent"><CalendarX2 size={26} aria-hidden /></span>
          <p className="font-semibold">Nenhuma visita neste período</p>
        </div>
      ) : (
        <VisitCards openId={wanted} list={list.map((v) => ({ id: v.id, code: v.code, status: v.status, canceled: !!v.canceled_at, kind: v.kind, visitDate: v.visit_date, link: v.link, at: new Date(v.at).toISOString(), note: v.note, confirmedAt: v.confirmed_at ? new Date(v.confirmed_at).toISOString() : null, repName: v.rep_name, repSap: v.rep_sap, repCity: v.rep_city, repKm: v.rep_km, sellerName: v.seller_name, leadId: v.lead_id, company: v.company, city: v.city, uf: v.uf, sfUrl: v.sf_url, eoxUrl: v.eox_url, cnpj: v.cnpj, phones: v.phones ?? [], email: v.email, contactName: v.contact_name, roleTitle: v.role_title, canManage: v.owner_id === me.id || !!me.permissions["lead.edit"] || (v.kind === "seller" && hasSellerPart(me.roles)), by: v.name ? { name: v.name, hex: bubbleHex(v.accent, v.uid ?? 0, v.roles ?? undefined) } : null }))} />
      )}
    </div>
  );
}
