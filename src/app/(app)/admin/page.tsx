import { sql } from "drizzle-orm";
import { ArrowUpRight, Briefcase, Database, DatabaseZap, FileClock, Radio, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_SECTIONS } from "@/config/admin-sections";
import { db } from "@/db";
import { panelCls } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Central do Adm" };
export const dynamic = "force-dynamic";

/** Central do Adm: números do sistema, atalhos para cada área e as últimas alterações. */
export default async function AdminHome() {
  const [[c], recent] = await Promise.all([
    db.execute<{ users: number; online: number; leads: number; consulted: number; deals: number; tests: number }>(sql`
      select (select count(*)::int from users where active) users,
             (select count(*)::int from presence where last_seen_at > now() - interval '90 seconds') online,
             (select count(*)::int from leads where not is_test) leads,
             (select count(*)::int from leads where not is_test and enriched_at is not null) consulted,
             (select count(*)::int from deals where not is_test and stage not in ('ganho','perdido')) deals,
             (select count(*)::int from leads where is_test) tests`),
    db.execute<{ at: Date; who: string | null; action: string; field: string | null; new_value: string | null }>(sql`select a.at, u.name as who, a.action, a.field, a.new_value from audit_log a left join users u on u.id = a.user_id where a.entity in ('user','setting','tag','import') order by a.id desc limit 8`),
  ]);
  const pct = c.leads ? Math.round((c.consulted / c.leads) * 100) : 0;
  const tiles = [
    { I: Users, t: "Contas ativas", v: c.users, s: `${c.online} online agora`, href: "/admin/usuarios" },
    { I: Database, t: "Leads", v: c.leads, s: `${c.tests} de teste`, href: "/admin/banco" },
    { I: DatabaseZap, t: "CNPJ consultados", v: `${pct}%`, s: `${c.consulted.toLocaleString("pt-BR")} de ${c.leads.toLocaleString("pt-BR")}`, href: "/admin/consulta-cnpj" },
    { I: Briefcase, t: "Negociações abertas", v: c.deals, s: "em andamento", href: "/admin/vendas" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map(({ I, t, v, s, href }, i) => (
          <Link key={t} href={href} style={{ "--i": i } as React.CSSProperties} className={`${panelCls} stat-glow lift card-in group p-4`}>
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{t}</p><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><I size={15} aria-hidden /></span></div>
            <p className="figure mt-2 text-3xl font-bold leading-none">{typeof v === "number" ? v.toLocaleString("pt-BR") : v}</p>
            <p className="mt-1.5 flex items-center justify-between truncate text-xs text-muted">{s}<ArrowUpRight size={13} className="opacity-0 transition group-hover:opacity-100" aria-hidden /></p>
          </Link>
        ))}
      </div>

      {ADMIN_SECTIONS.map((s) => (
        <section key={s.id} className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden className="h-4 w-1 rounded-full" style={{ background: s.hue }} />{s.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.items.map(({ href, label, hint, icon: Icon }, i) => (
              <Link key={href} href={href} style={{ "--i": i } as React.CSSProperties} className={`${panelCls} lift card-in group flex items-center gap-3.5 p-4`}>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105" style={{ background: `color-mix(in srgb, ${s.hue} 16%, transparent)`, color: s.hue }}><Icon size={22} aria-hidden /></span>
                <span className="min-w-0"><span className="block font-semibold leading-tight">{label}</span><span className="block truncate text-xs text-muted">{hint}</span></span>
                <ArrowUpRight size={16} className="ml-auto shrink-0 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className={`${panelCls} overflow-hidden`}>
        <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold"><FileClock size={16} className="text-accent" aria-hidden /> Últimas alterações do sistema <Link href="/registro" className="ml-auto text-xs font-medium text-accent hover:underline">ver registro completo</Link></h2>
        <ul className="divide-y divide-line/70">
          {recent.map((r, i) => <li key={i} className="flex items-baseline gap-3 px-4 py-2.5 text-sm"><Radio size={12} className="mt-1 shrink-0 text-accent" aria-hidden /><span className="min-w-0 flex-1 truncate"><b className="font-semibold">{r.who ?? "Sistema"}</b> {r.action}{r.field ? ` · ${r.field}` : ""}{r.new_value ? <span className="text-muted"> → {r.new_value.slice(0, 60)}</span> : null}</span><span className="figure shrink-0 text-xs text-muted">{fmtDateTime(r.at)}</span></li>)}
          {!recent.length && <li className="p-6 text-center text-sm text-muted">Nenhuma alteração registrada ainda.</li>}
        </ul>
      </section>
    </div>
  );
}
