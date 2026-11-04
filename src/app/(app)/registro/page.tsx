import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { AuditFilters } from "@/components/audit-filters";
import { RevertButton } from "@/components/revert-button";
import { panelCls } from "@/components/ui";
import { db, users } from "@/db";
import { fmtDateTimeSec } from "@/lib/format";
import { ENTITY_LABEL, listAudit, parseAuditFilters } from "@/modules/audit/query";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Registro" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.registro");
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const [people, { total, rows, pages }] = await Promise.all([db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)), listAudit(f)]);
  const types: [string, string][] = [["lead", "Lead"], ["user", "Usuário"], ["tag", "Tag"], ["setting", "Configuração"], ["import", "Importação"], ["rep", "Representante"], ["template", "Modelo de e-mail"], ["session", "Atendimento"], ["goal", "Meta"]];
  const href = (n: number) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") p.set(k, v); p.set("page", String(n)); return `/registro?${p}`; };
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">Registro de atividades</h1>
      <Suspense fallback={null}><AuditFilters people={people} types={types} /></Suspense>
      <p className="text-sm font-medium">{new Intl.NumberFormat("pt-BR").format(total)} registro(s)</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={panelCls}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3.5 text-sm">
                <span className="rounded-md bg-sunk px-2 py-0.5 text-xs font-medium">{ENTITY_LABEL[r.entity] ?? r.entity}</span>
                <span className="min-w-0 flex-1"><b>{r.userName ?? "Sistema"}</b> {r.action}{r.field ? ` · ${r.field}` : ""}{r.company ? ` · ${r.company}` : ""}</span>
                <span className="text-xs text-muted">{fmtDateTimeSec(r.at)}</span>
              </summary>
              <div className="space-y-2 border-t border-line p-3.5 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted">Quando</dt><dd>{fmtDateTimeSec(r.at)} (Brasília)</dd>
                  <dt className="text-muted">Quem</dt><dd>{r.userName ?? "Sistema (automático)"}</dd>
                  {r.company && <><dt className="text-muted">Lead</dt><dd>{r.company}</dd></>}
                  {r.field && <><dt className="text-muted">Campo</dt><dd>{r.field}</dd></>}
                  <dt className="text-muted">De → para</dt><dd>{r.oldValue ?? "—"} → {r.newValue ?? "—"}</dd>
                  {r.meta ? <><dt className="text-muted">Detalhes</dt><dd className="break-words text-xs">{JSON.stringify(r.meta)}</dd></> : null}
                </dl>
                <div className="flex flex-wrap gap-2">
                  {r.leadId && <Link className="underline" href={`/leads?q=${encodeURIComponent(r.company ?? "")}`}>Abrir lead</Link>}
                  {me.permissions["audit.revert"] && r.leadId && <RevertButton id={r.id} />}
                </div>
              </div>
            </details>
          </li>
        ))}
        {rows.length === 0 && <li className={`${panelCls} p-6 text-center text-muted`}>Nenhum registro com esses filtros.</li>}
      </ul>
      {pages > 1 && <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">{f.page > 1 && <Link className="underline" href={href(f.page - 1)}>Anterior</Link>}<span>Página {f.page} de {pages}</span>{f.page < pages && <Link className="underline" href={href(f.page + 1)}>Próxima</Link>}</nav>}
    </div>
  );
}
