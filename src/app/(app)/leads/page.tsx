import { PersonBubble } from "@/components/person-bubble";
import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Suspense } from "react";
import { AttendButton } from "@/components/attend-button";
import { LeadFilters } from "@/components/lead-filters";
import { TagChip } from "@/components/tag-chip";
import { panelCls } from "@/components/ui";
import { db, leads, users } from "@/db";
import { bubbleHex } from "@/config/theme";
import { fmtCnpj } from "@/lib/format";
import { requirePerm } from "@/modules/auth/guard";
import { listLeads, parseFilters } from "@/modules/leads/list";
import { getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePerm("tab.leads");
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [catalog, people, ufRows, { total, rows, pages }] = await Promise.all([
    getTagCatalog(),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
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
      <h1 className="display text-3xl">Leads</h1>
      <Suspense fallback={null}>
        <LeadFilters catalog={catalog} people={people} ufs={ufRows.map((r) => r.uf!).filter(Boolean)} />
      </Suspense>

      <p className="text-sm font-medium">{new Intl.NumberFormat("pt-BR").format(total)} lead(s)</p>
      <ul className="space-y-2">
        {rows.map((l) => {
          const accent = l.owner_name ? { hex: bubbleHex(l.owner_accent, l.owner_id ?? 0, l.owner_roles ?? undefined) } : null;
          return (
            <li key={l.id} className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
              <div className="min-w-0 flex-1">
                <Link href={`/leads/${l.id}`} className="block truncate font-medium hover:underline">{l.trade_name ?? l.company}</Link>
                <p className="text-xs text-muted">{fmtCnpj(l.cnpj)}{l.city ? ` · ${l.city}/${l.uf}` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.tags.map((t) => <TagChip key={t.label} label={t.label} color={t.color} />)}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {l.locked_by_name && <PersonBubble name={l.locked_by_name} hex={bubbleHex(l.locked_by_accent, l.locked_by_id ?? 0, l.locked_roles ?? undefined)} prefix="Atendendo" />}
                {accent && <PersonBubble name={l.owner_name!} hex={accent.hex} prefix="Responsável" />}
                {!accent && !l.locked_by_name && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Sem responsável</span>}
                {!l.locked_by_name && <AttendButton leadId={l.id} compact />}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className={`${panelCls} p-6 text-center text-muted`}>Nenhum lead com esses filtros.</li>}
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
