import { FilterBar } from "@/components/filter-bar";
import { db } from "@/db";
import { Pagination } from "@/components/pagination";
import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { History, CalendarCheck, CheckCircle2, Clock, Search, Timer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendButton } from "@/components/attend-button";
import { DateField } from "@/components/date-field";
import { TagChip } from "@/components/tag-chip";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtCnpj, fmtDate, fmtDuration, plural, TZ } from "@/lib/format";
import { isSellerOnly } from "@/config/roles";
import { requirePerm } from "@/modules/auth/guard";
import { parseHistFilters, userHistoryRich, type HistRow } from "@/modules/leads/history";

export const metadata: Metadata = { title: "Meu histórico" };
export const dynamic = "force-dynamic";

const hourFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d)); // AAAA-MM-DD

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.historico");
  const sp = await searchParams;
  /* Quem só vende tem o histórico dele na janela de Vendas. */
  if (isSellerOnly(me.roles) && me.permissions["tab.historico_vendas"]) redirect("/historico-vendas");
  const f = parseHistFilters(sp);
  const rows = await userHistoryRich(me.id, f);
  const dealRows = rows.length ? await db.execute<{ lead_id: number }>(sql`select distinct lead_id from deals where lead_id in (${sql.join([...new Set(rows.map((r) => r.lead_id))].map((i) => sql`${i}`), sql`, `)})`) : [];
  const inDeal = new Set(dealRows.map((r) => r.lead_id));

  const todayKey = dayKey(new Date().toISOString());
  const yKey = dayKey(new Date(Date.now() - 864e5).toISOString());
  const preset = (days: number) => { const to = todayKey; const from = dayKey(new Date(Date.now() - (days - 1) * 864e5).toISOString()); return `/historico?from=${from}&to=${to}`; };

  // Estatísticas do que está filtrado
  const timed = rows.filter((r) => r.seconds != null && r.seconds < 6 * 3600);
  const avg = timed.length ? Math.round(timed.reduce((a, r) => a + (r.seconds ?? 0), 0) / timed.length) : null;
  const qualified = rows.filter((r) => r.tags.some((t) => t.group === "qualificacao" && t.key === "qualificado")).length;
  const scheduled = rows.filter((r) => r.visits).length;
  const rate = rows.length ? Math.round((qualified / rows.length) * 100) : 0;

  const byDay = new Map<string, HistRow[]>();
  for (const r of rows) { const k = dayKey(r.saved_at); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const days = [...byDay.entries()];
  // A lista é paginada: desenhar centenas de cartões de uma vez travava a tela (e o scroll).
  const PAGE = 30;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pg = Math.min(pages, Math.max(1, Number(typeof sp.p === "string" ? sp.p : 1) || 1));
  const pageByDay = new Map<string, HistRow[]>();
  for (const r of rows.slice((pg - 1) * PAGE, pg * PAGE)) { const k = dayKey(r.saved_at); pageByDay.set(k, [...(pageByDay.get(k) ?? []), r]); }
  const pageDays = [...pageByDay.entries()];
  const pageHref = (n: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "p") u.set(k, v); if (n > 1) u.set("p", String(n)); return `/historico${u.size ? `?${u}` : ""}`; };
  const spark = days.slice(0, 14).reverse();
  const max = Math.max(1, ...spark.map(([, v]) => v.length));
  const label = (k: string) => (k === todayKey ? "Hoje" : k === yKey ? "Ontem" : fmtDate(`${k}T12:00:00-03:00`));
  const hasFilter = !!(f.q || f.from || f.to || f.qual || f.visit);

  return (
    <div className="space-y-6">
      <PageHead icon={History} title="Meu histórico">
        <Link prefetch={false} className={btnGhost} href={preset(1)}>Hoje</Link>
        <Link prefetch={false} className={btnGhost} href={preset(7)}>7 dias</Link>
        <Link prefetch={false} className={btnGhost} href={preset(30)}>30 dias</Link>
        <Link prefetch={false} className={btnGhost} href="/historico">Tudo</Link>
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CheckCircle2 size={18} />} label="Atendidos" value={String(rows.length)} hint={rows.length === 600 ? "mostrando os 600 mais recentes" : undefined} />
        <Stat icon={<Timer size={18} />} label="Tempo médio" value={fmtDuration(avg)} />
        <Stat icon={<Clock size={18} />} label="Qualificados" value={String(qualified)} hint={`${rate}% dos atendidos`} />
        <Stat icon={<CalendarCheck size={18} />} label="Com visita agendada" value={String(scheduled)} />
      </div>

      {spark.length > 1 && (
        <section className={`${panelCls} p-4`} aria-label="Atendimentos por dia">
          <p className="mb-3 text-sm font-semibold">Atendimentos por dia</p>
          <div className="flex h-28 items-end gap-1.5">
            {spark.map(([k, v]) => (
              <div key={k} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${label(k)}: ${plural(v.length, "atendimento", "atendimentos")}`}>
                <span className="figure text-[11px] text-muted opacity-0 transition group-hover:opacity-100">{v.length}</span>
                <div className="w-full rounded-t-md bg-grad opacity-70 transition-all group-hover:opacity-100" style={{ height: `${(v.length / max) * 100}%`, minHeight: 4 }} />
                <span className="text-[10px] text-muted">{k.slice(8)}/{k.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <FilterBar id="historico" active={[f.q, f.from, f.to, f.qual, f.visit].filter(Boolean).length}>
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="text-sm sm:col-span-2 lg:col-span-1"><span className="mb-1 block text-muted">Buscar</span><span className="relative block"><Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input name="q" defaultValue={f.q} placeholder="Empresa, CNPJ, cidade ou observação" className={`${inputCls} pl-9`} /></span></label>
        <div className="text-sm"><span className="mb-1 block text-muted">De</span><DateField name="from" label="De" defaultValue={f.from} /></div>
        <div className="text-sm"><span className="mb-1 block text-muted">Até</span><DateField name="to" label="Até" defaultValue={f.to} /></div>
        <label className="text-sm"><span className="mb-1 block text-muted">Qualificação</span>
          <select name="qual" defaultValue={f.qual ?? ""} className={inputCls}>
            <option value="">Todas</option><option value="qualificado">Qualificado</option><option value="desqualificado">Desqualificado</option><option value="sem">Sem qualificação</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-1.5 pb-2.5 text-sm"><input type="checkbox" name="visit" value="1" defaultChecked={!!f.visit} className="size-4" /> Só com visita</label>
          <button className={btnPrimary} type="submit">Filtrar</button>
          {hasFilter && <Link className={btnGhost} href="/historico">Limpar</Link>}
        </div>
      </form>
      </FilterBar>

      {days.length === 0 ? (
        <div className={`${panelCls} p-10 text-center text-muted`}>{hasFilter ? "Nada encontrado com esses filtros." : "Você ainda não atendeu nenhum lead."}</div>
      ) : pageDays.map(([k, list]) => (
        <section key={k} className="space-y-2">
          <h2 className="sticky top-14 z-10 flex items-center gap-2 py-1 text-sm font-semibold"><span className="display rounded-full bg-grad px-3.5 py-1 text-base text-on-accent shadow">{label(k)}</span><span className="rounded-full bg-panel/80 px-2.5 py-0.5 font-normal text-muted backdrop-blur">{plural(list.length, "atendimento", "atendimentos")}</span><span aria-hidden className="h-px flex-1 bg-line" /></h2>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.session_id} className={`${panelCls} lift card-in relative flex flex-wrap items-start gap-3 overflow-hidden p-4 pl-5`} style={{ "--i": Math.min(list.indexOf(r), 10) } as React.CSSProperties}>
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: r.tags.some((t) => t.group === "qualificacao" && t.key === "qualificado") ? "var(--accent)" : r.tags.some((t) => t.group === "qualificacao") ? "var(--danger)" : "var(--line)" }} />
                <span className="figure mt-0.5 hidden shrink-0 rounded-xl bg-grad-soft px-2.5 py-1.5 text-center text-sm font-bold text-accent sm:block">{hourFmt.format(new Date(r.saved_at))}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link prefetch={false} href={`/leads/${r.lead_id}`} className="block truncate font-medium hover:underline">{r.trade_name ?? r.company}</Link>
                  <p className="text-xs text-muted"><span className="sm:hidden">{hourFmt.format(new Date(r.saved_at))} · </span>{fmtCnpj(r.cnpj)}{r.city ? ` · ${r.city}/${r.uf}` : ""} · tempo {fmtDuration(r.seconds)}{r.visits ? ` · visita ${r.visits}` : ""}</p>
                  {r.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{r.tags.map((t) => <TagChip key={t.key + t.group} label={t.label} color={t.color} />)}</div>}
                  {r.notes && <p className="line-clamp-2 rounded-md bg-sunk px-2.5 py-1.5 text-xs text-muted">{r.notes}</p>}
                </div>
                {inDeal.has(r.lead_id) ? <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">Vendas</span> : <AttendButton leadId={r.lead_id} compact />}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Pagination page={pg} pages={pages} href={pageHref} />
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className={`${panelCls} stat-glow lift card-in flex items-center gap-3 p-4`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-grad-soft text-accent">{icon}</span>
      <div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="figure text-2xl font-bold leading-tight">{value}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
    </div>
  );
}
