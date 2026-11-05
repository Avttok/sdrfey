import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { CalendarCheck, CalendarX2, ExternalLink } from "lucide-react";
import { Suspense } from "react";
import { DashboardFilters } from "@/components/dashboard-filters";
import { PageHead } from "@/components/page-head";
import { PersonBubble } from "@/components/person-bubble";
import { panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import type { Role } from "@/config/roles";
import { db, users } from "@/db";
import { dayEnd, dayStart, fmtDate, fmtDateTime, plural } from "@/lib/format";
import { requirePerm } from "@/modules/auth/guard";
import { resolvePeriod } from "@/modules/dashboard/stats";

export const metadata: Metadata = { title: "Visitas" };
export const dynamic = "force-dynamic";

type Row = { visit_date: string | null; id: number; code: string; at: Date; note: string | null; canceled_at: Date | null; lead_id: number; company: string; city: string | null; uf: string | null; uid: number | null; name: string | null; accent: string | null; roles: Role[] | null };

/** Todas as visitas agendadas. Cada pessoa vê as suas; quem tem a permissão vê as da equipe. */
export default async function VisitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.visitas");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const period = resolvePeriod({ p: one("p") ?? (one("from") || one("to") ? undefined : "30"), from: iso("from"), to: iso("to") });
  const team = !!me.permissions["visits.team"];

  const all = await db.select().from(users).where(and(eq(users.active, true))).orderBy(asc(users.name));
  const people = all.map((u) => ({ id: u.id, name: u.name, hex: bubbleHex(u.accent, u.id, u.roles) }));
  const picked = (Array.isArray(sp.u) ? sp.u : sp.u ? [sp.u] : []).map(Number).filter((id) => people.some((p) => p.id === id));
  const scope = team ? (picked.length ? picked : null) : [me.id];

  const from = dayStart(period.from).toISOString();
  const to = dayEnd(period.to).toISOString();
  const who = scope ? sql`and v.user_id in (${sql.join(scope.map((i) => sql`${i}`), sql`, `)})` : sql``;
  const rows = await db.execute<Row>(sql`
    select v.id, v.visit_date::text as visit_date, v.code, v.created_at as at, v.note, v.canceled_at, l.id as lead_id, l.company, l.city, l.uf, u.id as uid, u.name, u.accent, u.roles
    from visits v join leads l on l.id = v.lead_id left join users u on u.id = v.user_id
    where not l.is_test and v.created_at between ${from}::timestamptz and ${to}::timestamptz ${who}
    order by v.created_at desc limit 500`);
  const list = [...rows];
  const active = list.filter((v) => !v.canceled_at);
  const canceled = list.length - active.length;

  return (
    <div className="space-y-5">
      <PageHead icon={CalendarCheck} title="Visitas" subtitle={`${team ? "Equipe" : "Suas visitas"} · ${plural(active.length, "visita agendada", "visitas agendadas")}${canceled ? ` · ${plural(canceled, "cancelada", "canceladas")}` : ""} · ${period.from === period.to ? fmtDate(period.from) : `${fmtDate(period.from)} a ${fmtDate(period.to)}`}`} />
      <div className={`${panelCls} p-4`}><Suspense fallback={null}>
        <DashboardFilters preset={period.preset} from={period.preset === "custom" ? period.from : ""} to={period.preset === "custom" ? period.to : ""} people={team ? people : []} selected={scope ?? []} />
      </Suspense></div>

      {list.length === 0 ? (
        <div className={`${panelCls} grid place-items-center gap-2 p-12 text-center`}>
          <span className="grid size-14 place-items-center rounded-2xl bg-grad-soft text-accent"><CalendarX2 size={26} aria-hidden /></span>
          <p className="font-semibold">Nenhuma visita neste período</p>
          <p className="text-sm text-muted">As visitas aparecem aqui quando alguém marca &ldquo;Agendado&rdquo; no Shuffler.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => (
            <li key={v.id}>
              <Link href={`/leads/${v.lead_id}`} className={`${panelCls} group relative block h-full overflow-hidden p-4 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg ${v.canceled_at ? "opacity-60" : ""}`}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-grad" />
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-md bg-grad px-2 py-0.5 text-xs font-bold text-on-accent">{v.code}</span>
                  {v.canceled_at ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">Cancelada</span> : <ExternalLink size={15} className="text-muted opacity-0 transition group-hover:opacity-100" aria-hidden />}
                </div>
                <p className="mt-3 font-semibold leading-snug">{v.company}</p>
                {(v.city || v.uf) && <p className="text-sm text-muted">{[v.city, v.uf].filter(Boolean).join(" / ")}</p>}
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium"><CalendarCheck size={15} className="text-accent" aria-hidden /> {v.visit_date ? `Visita em ${fmtDate(v.visit_date)}` : "Data da visita não informada"}</p>
                {v.note && <p className="mt-2 line-clamp-2 text-sm text-muted">{v.note}</p>}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                  {v.name ? <span className="flex min-w-0 items-center gap-2"><span className="text-muted/80">Agendada por</span><PersonBubble name={v.name} hex={bubbleHex(v.accent, v.uid ?? 0, v.roles ?? undefined)} /></span> : <span />}
                  <span className="shrink-0">em {fmtDateTime(v.at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
