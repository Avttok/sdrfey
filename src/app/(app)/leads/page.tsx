import { visibleUsers } from "@/modules/auth/visibility";
import { RoteiroLink } from "@/components/roteiro-link";
import { Pagination } from "@/components/pagination";
import { PersonBubble } from "@/components/person-bubble";
import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { Activity, Handshake, Mail, MapPin, Phone, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { Suspense } from "react";
import { AttendButton } from "@/components/attend-button";
import { LeadFilters } from "@/components/lead-filters";
import { LeadToolbar } from "@/components/lead-toolbar";
import { MARKER_BY_KEY } from "@/config/markers";
import { TagChip } from "@/components/tag-chip";
import { btnSmGhost, panelCls } from "@/components/ui";
import { db, leads, users } from "@/db";
import { bubbleHex } from "@/config/theme";
import { fmtCnpj } from "@/lib/format";
import { hasRole, isSellerOnly } from "@/config/roles";
import { StageChip } from "@/components/deals/deal-ui";
import type { DealStage } from "@/db/schema";
import { requirePerm } from "@/modules/auth/guard";
import { listLeads, parseFilters } from "@/modules/leads/list";
import { getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.leads");
  const sellerView = isSellerOnly(me.roles);
  const sp = await searchParams;
  const filters = { ...parseFilters(sp), sellerScope: sellerView ? me.id : undefined };
  const [catalog, people, ufRows, { total, rows, pages }, [stat], batchRows] = await Promise.all([
    getTagCatalog(),
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name)),
    db.selectDistinct({ uf: leads.uf }).from(leads).where(sql`${leads.uf} is not null`).orderBy(asc(leads.uf)),
    listLeads(filters),
    sellerView ? Promise.resolve([null]) : db.execute<{ all: number; free: number; busy: number; deals: number; prospect: number; inativo: number }>(sql`
      select count(*)::int as "all",
        count(*) filter (where locked_by is null and owner_id is null and not exists (select 1 from deals d where d.lead_id = leads.id and d.stage not in ('ganho','perdido')))::int as free,
        count(*) filter (where locked_by is not null)::int as busy,
        count(*) filter (where kind = 'prospect')::int as prospect, count(*) filter (where kind = 'inativo')::int as inativo,
        count(*) filter (where exists (select 1 from deals d where d.lead_id = leads.id and d.stage not in ('ganho','perdido')))::int as deals
      from leads where not is_test`),
    sellerView ? Promise.resolve([] as { id: number; file_name: string; created_at: Date; inserted: number }[]) : db.execute<{ id: number; file_name: string; created_at: Date; inserted: number }>(sql`select id, file_name, created_at, inserted from import_batches where kind in ('leads', 'inativos') and undone_at is null order by id desc limit 40`),
  ]);

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v ? [v] : []) if (k !== "page") p.append(k, x);
    p.set("page", String(n));
    return `/leads?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHead icon={Users} title="Leads">
        {hasRole(me.roles, "admin") ? (
          <Link href="/admin/banco" title="Saúde do sistema" className="rounded-full bg-accent/15 px-3.5 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/25"><span className="figure">{new Intl.NumberFormat("pt-BR").format(total)}</span> {total === 1 ? "lead" : "leads"}</Link>
        ) : (
          <p className="rounded-full bg-accent/15 px-3.5 py-1.5 text-sm font-semibold text-accent"><span className="figure">{new Intl.NumberFormat("pt-BR").format(total)}</span> {total === 1 ? "lead" : "leads"}</p>
        )}
      </PageHead>
      {stat && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([["Na base", stat.all, Users, "text-accent"], ["Livres", stat.free, Sparkles, "text-ok"], ["Em atendimento agora", stat.busy, Activity, "text-warn"], ["Em vendas", stat.deals, Handshake, "text-accent"]] as const).map(([l, v, I, c], i) => (
            <div key={l} style={{ "--i": i } as React.CSSProperties} className={`${panelCls} stat-glow card-in flex items-center gap-3 p-4`}>
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-grad-soft ${c}`}><I size={19} aria-hidden /></span>
              <div className="min-w-0"><p className="truncate text-xs text-muted">{l}</p><p className="figure text-2xl font-bold leading-tight">{new Intl.NumberFormat("pt-BR").format(v)}</p></div>
            </div>
          ))}
        </div>
      )}
      <Suspense fallback={null}>
        <LeadFilters sellerView={sellerView} catalog={catalog} people={people} ufs={ufRows.map((r) => r.uf!).filter(Boolean)} batches={[...batchRows].map((b) => ({ id: b.id, label: `${b.file_name} · ${new Date(b.created_at).toLocaleDateString("pt-BR")} · ${b.inserted}` }))} />
      </Suspense>

      <Suspense fallback={null}><LeadToolbar total={total} counts={stat ?? undefined} /></Suspense>

      {sp.view === "lista" ? (
        <ul className={`${panelCls} divide-y divide-line overflow-hidden`}>
          <li aria-hidden className="hidden grid-cols-[2.5rem_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_13rem] items-center gap-4 bg-sunk/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted lg:grid"><span /><span>Empresa</span><span>Local e situação</span><span>Contatos e responsáveis</span><span className="text-right">Ações</span></li>
          {rows.map((l, i) => {
            const name = l.trade_name ?? l.company;
            const active = l.status?.toUpperCase() === "ATIVA";
            const initials = name.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name[0];
            return (
              <li key={l.id} style={{ "--i": i % 12 } as React.CSSProperties} className="card-in grid items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-sunk/50 lg:grid-cols-[2.5rem_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_13rem]">
                <span aria-hidden className={`hidden size-10 place-items-center rounded-xl text-xs font-bold lg:grid ${l.status ? "bg-grad text-on-accent" : "bg-sunk text-muted"}`}>{initials}</span>
                <div className="min-w-0"><Link href={`/leads/${l.id}`} className="block truncate font-semibold transition-colors hover:text-accent">{name}</Link><p className="figure truncate text-xs text-muted">{fmtCnpj(l.cnpj)}</p></div>
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{l.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{l.city}/{l.uf}</span>}{l.status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{l.status.toUpperCase()}</span>}</p>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 font-medium"><Phone size={11} className="text-accent" aria-hidden /><span className="figure">{l.phones}</span></span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 font-medium"><Mail size={11} className="text-accent" aria-hidden /><span className="figure">{l.emails}</span></span>
                  {sellerView ? (l.deal_stage && <StageChip stage={l.deal_stage as DealStage} />) : <>
                    {l.locked_by_name && <PersonBubble userId={l.locked_by_id} name={l.locked_by_name} hex={bubbleHex(l.locked_by_accent, l.locked_by_id ?? 0, l.locked_roles ?? undefined)} prefix="Atendendo" />}
                    {l.owner_name && <PersonBubble userId={l.owner_id} name={l.owner_name} hex={bubbleHex(l.owner_accent, l.owner_id ?? 0, l.owner_roles ?? undefined)} />}
                    {l.seller_name && <PersonBubble userId={l.seller_id} name={l.seller_name} hex={bubbleHex(l.seller_accent, l.seller_id ?? 0, l.seller_roles ?? undefined)} />}
                    {!l.owner_name && !l.locked_by_name && !l.seller_name && <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-muted">Livre</span>}
                  </>}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {!sellerView && (l.deal_id ? <span className="whitespace-nowrap rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">Vendas</span> : !l.locked_by_name && (l.kind === "inativo" ? !!me.permissions["tab.shuffler_vendas"] : !!me.permissions["tab.comecar"]) && <AttendButton leadId={l.id} sales={l.kind === "inativo"} compact />)}
                  <RoteiroLink leadId={l.id} compact /><Link href={`/leads/${l.id}`} className={btnSmGhost}>Abrir</Link>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && <li className="p-10 text-center text-muted">Nenhum lead com esses filtros.</li>}
        </ul>
      ) : (
      <ul className="grid gap-3 xl:grid-cols-2">
        {rows.map((l, i) => {
          const name = l.trade_name ?? l.company;
          const active = l.status?.toUpperCase() === "ATIVA";
          const initials = name.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name[0];
          const tone = l.status ? (active ? "var(--ok)" : "var(--danger)") : "var(--line)";
          return (
            <li key={l.id} style={{ "--i": i % 12 } as React.CSSProperties} className={`${panelCls} card-in lift group relative flex flex-col gap-3 overflow-hidden p-4 pl-5`}>
              <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: tone }} />
              <div className="flex items-start gap-3">
                <span aria-hidden className={`grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-bold shadow-sm ${l.status ? "bg-grad text-on-accent" : "bg-sunk text-muted"}`}>{initials}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${l.id}`} className="block truncate text-base font-semibold transition-colors group-hover:text-accent">{name}</Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
                    <span className="figure">{fmtCnpj(l.cnpj)}</span>
                    {l.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{l.city}/{l.uf}</span>}
                  </p>
                </div>
                {l.status && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${active ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{l.status.toUpperCase()}</span>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sunk px-2.5 py-1 font-medium"><Phone size={12} className="text-accent" aria-hidden /><span className="figure">{l.phones}</span> {l.phones === 1 ? "telefone" : "telefones"}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sunk px-2.5 py-1 font-medium"><Mail size={12} className="text-accent" aria-hidden /><span className="figure">{l.emails}</span> {l.emails === 1 ? "e-mail" : "e-mails"}</span>
              </div>
              {(l.markers ?? []).length > 0 && <div className="flex flex-wrap gap-1.5">{(l.markers ?? []).filter((k) => ["site", "redes", "celular", "email", "cliente", "negociacao"].includes(k)).map((k) => { const m = MARKER_BY_KEY.get(k); return m ? <TagChip key={`mk-${k}`} label={m.label} color={m.color} /> : null; })}</div>}
              {!sellerView && l.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{l.tags.map((t) => <TagChip key={t.label} label={t.label} color={t.color} />)}</div>}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {sellerView ? (l.deal_stage && <StageChip stage={l.deal_stage as DealStage} />) : <>
                    {l.locked_by_name && <PersonBubble userId={l.locked_by_id} name={l.locked_by_name} hex={bubbleHex(l.locked_by_accent, l.locked_by_id ?? 0, l.locked_roles ?? undefined)} prefix="Atendendo" />}
                    {l.owner_name && <PersonBubble userId={l.owner_id} name={l.owner_name} hex={bubbleHex(l.owner_accent, l.owner_id ?? 0, l.owner_roles ?? undefined)} />}
                    {l.seller_name && <PersonBubble userId={l.seller_id} name={l.seller_name} hex={bubbleHex(l.seller_accent, l.seller_id ?? 0, l.seller_roles ?? undefined)} />}
                    {!l.owner_name && !l.locked_by_name && !l.seller_name && <span className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">Livre</span>}
                  </>}
                </div>
                <div className="flex items-center gap-2">
                  {!sellerView && (l.deal_id ? <span className="whitespace-nowrap rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">Vendas</span> : !l.locked_by_name && (l.kind === "inativo" ? !!me.permissions["tab.shuffler_vendas"] : !!me.permissions["tab.comecar"]) && <AttendButton leadId={l.id} sales={l.kind === "inativo"} compact />)}
                  <RoteiroLink leadId={l.id} compact /><Link href={`/leads/${l.id}`} className={btnSmGhost}>Abrir</Link>
                </div>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className={`${panelCls} p-10 text-center text-muted xl:col-span-2`}>Nenhum lead com esses filtros.</li>}
      </ul>
      )}

      {pages > 1 && (
        <Pagination page={filters.page} pages={pages} href={pageHref} total={total} label="leads" />
      )}
    </div>
  );
}
