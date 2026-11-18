import { visibleUsers } from "@/modules/auth/visibility";
import { PersonBubble } from "@/components/person-bubble";
import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { Mail, MapPin, Phone, Users } from "lucide-react";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { Suspense } from "react";
import { AttendButton } from "@/components/attend-button";
import { LeadFilters } from "@/components/lead-filters";
import { TagChip } from "@/components/tag-chip";
import { panelCls } from "@/components/ui";
import { db, leads, users } from "@/db";
import { bubbleHex } from "@/config/theme";
import { fmtCnpj } from "@/lib/format";
import { isSellerOnly } from "@/config/roles";
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
  const [catalog, people, ufRows, { total, rows, pages }] = await Promise.all([
    getTagCatalog(),
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name)),
    db.selectDistinct({ uf: leads.uf }).from(leads).where(sql`${leads.uf} is not null`).orderBy(asc(leads.uf)),
    listLeads(filters),
  ]);

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v ? [v] : []) if (k !== "page") p.append(k, x);
    p.set("page", String(n));
    return `/leads?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <PageHead icon={Users} title="Leads" subtitle={sellerView ? "Clientes repassados pelos SDRs para você e para o grupo de vendedores." : "Busque, filtre e abra qualquer lead. ATENDER traz o lead para o seu Shuffler."}>
        <p className="rounded-full bg-accent/15 px-3.5 py-1.5 text-sm font-semibold text-accent"><span className="figure">{new Intl.NumberFormat("pt-BR").format(total)}</span> {total === 1 ? "lead" : "leads"}</p>
      </PageHead>
      <Suspense fallback={null}>
        <LeadFilters sellerView={sellerView} catalog={catalog} people={people} ufs={ufRows.map((r) => r.uf!).filter(Boolean)} />
      </Suspense>

      <ul className="space-y-2.5">
        {rows.map((l) => {
          const name = l.trade_name ?? l.company;
          const active = l.status?.toUpperCase() === "ATIVA";
          const initials = name.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name[0];
          return (
            <li key={l.id} className={`${panelCls} group flex flex-wrap items-center gap-4 p-4 transition hover:border-accent/50 hover:shadow-md`}>
              <span aria-hidden className={`grid size-12 shrink-0 place-items-center rounded-xl text-sm font-bold ${l.status ? (active ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger") : "bg-sunk text-muted"}`}>{initials}</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Link href={`/leads/${l.id}`} className="block truncate text-[15px] font-semibold group-hover:text-accent">{name}</Link>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>{fmtCnpj(l.cnpj)}</span>
                  {l.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{l.city}/{l.uf}</span>}
                  {l.status && <b className={active ? "text-ok" : "text-danger"}>{l.status.toUpperCase()}</b>}
                  <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden />{l.phones}</span>
                  <span className="inline-flex items-center gap-1"><Mail size={12} aria-hidden />{l.emails}</span>
                </p>
                {!sellerView && l.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{l.tags.map((t) => <TagChip key={t.label} label={t.label} color={t.color} />)}</div>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {sellerView ? (l.deal_stage && <StageChip stage={l.deal_stage as DealStage} />) : <>
                  {l.locked_by_name && <PersonBubble name={l.locked_by_name} hex={bubbleHex(l.locked_by_accent, l.locked_by_id ?? 0, l.locked_roles ?? undefined)} prefix="Atendendo" />}
                  {l.owner_name && <PersonBubble name={l.owner_name} hex={bubbleHex(l.owner_accent, l.owner_id ?? 0, l.owner_roles ?? undefined)} />}
                  {l.seller_name && <PersonBubble name={l.seller_name} hex={bubbleHex(l.seller_accent, l.seller_id ?? 0, l.seller_roles ?? undefined)} prefix="Vendas" />}
                  {!l.owner_name && !l.locked_by_name && !l.seller_name && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Livre</span>}
                  {l.deal_id ? <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">Com os vendedores</span> : !l.locked_by_name && me.permissions["tab.comecar"] && <AttendButton leadId={l.id} compact />}
                </>}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className={`${panelCls} p-10 text-center text-muted`}>Nenhum lead com esses filtros.</li>}
      </ul>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">
          {filters.page > 1 && <Link className="underline" href={pageHref(filters.page - 1)}>Anterior</Link>}
          <span>Página {filters.page} de {pages}</span>
          {filters.page < pages && <Link className="underline" href={pageHref(filters.page + 1)}>Próxima</Link>}
        </nav>
      )}
    </div>
  );
}
