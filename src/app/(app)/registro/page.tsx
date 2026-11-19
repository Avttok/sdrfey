import { visibleUsers } from "@/modules/auth/visibility";
import { Pagination } from "@/components/pagination";
import { describeMeta } from "@/lib/audit-meta";
import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { ScrollText, Handshake, Trash2, Coins, MessageCircle, ArrowRight, Download, ExternalLink, FileText, Gauge, Settings2, Tag, Target, Upload, User, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { AuditFilters } from "@/components/audit-filters";
import { PersonBubble } from "@/components/person-bubble";
import { RevertButton } from "@/components/revert-button";
import { btnGhost, panelCls } from "@/components/ui";
import { bubbleHex } from "@/config/theme";
import { db, users } from "@/db";
import { fmtDateTimeSec, plural, TZ } from "@/lib/format";
import { ENTITY_LABEL, auditStats, groupAudit, listAudit, parseAuditFilters } from "@/modules/audit/query";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Registro" };
export const dynamic = "force-dynamic";

const ICON: Record<string, typeof User> = { lead: Users, visit: Users, user: UserRound, tag: Tag, setting: Settings2, import: Upload, rep: Users, template: FileText, session: Gauge, goal: Target, deal: Handshake, purge: Trash2, shop: Coins, chat: MessageCircle };
const TONE: Record<string, string> = { lead: "bg-grad-soft text-accent", visit: "bg-grad-soft text-accent", user: "bg-warn/15 text-warn", tag: "bg-ok/15 text-ok", setting: "bg-sunk text-muted", import: "bg-ok/15 text-ok", rep: "bg-grad-soft text-accent", template: "bg-sunk text-ink", session: "bg-grad-soft text-accent", goal: "bg-warn/15 text-warn", deal: "bg-ok/15 text-ok", purge: "bg-danger/15 text-danger", shop: "bg-warn/15 text-warn", chat: "bg-grad-soft text-accent" };
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const hourFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.registro");
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const [people, { total, rows, pages }, stats] = await Promise.all([db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name)), listAudit({ ...f, viewer: me }), auditStats(me)]);
  const types: [string, string][] = [["lead", "Lead"], ["user", "Usuário"], ["tag", "Tag"], ["setting", "Configuração"], ["import", "Importação"], ["rep", "Representante"], ["template", "Modelo de e-mail"], ["session", "Atendimento"], ["goal", "Meta"], ["deal", "Negociação"], ["purge", "Exclusão"], ["shop", "Loja"], ["chat", "Chat"]];
  const href = (n: number) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") p.set(k, v); p.set("page", String(n)); return `/registro?${p}`; };
  const typeHref = (t: string) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page" && k !== "type") p.set(k, v); if (t) p.set("type", t); return `/registro?${p}`; };

  const today = dayFmt.format(new Date()), yest = dayFmt.format(new Date(Date.now() - 864e5));
  const label = (k: string) => (k === today ? "Hoje" : k === yest ? "Ontem" : fmtDateTimeSec(`${k}T12:00:00-03:00`).slice(0, 10));
  const groups = groupAudit(rows);
  const byDay = new Map<string, typeof groups>();
  for (const g of groups) { const k = dayFmt.format(g.rows[0].at); byDay.set(k, [...(byDay.get(k) ?? []), g]); }

  return (
    <div className="space-y-5">
      <PageHead icon={ScrollText} title="Registro de atividades">
        <div className="flex items-center gap-2">
          <p className="rounded-full bg-accent/15 px-3.5 py-1.5 text-sm font-semibold text-accent"><span className="figure">{new Intl.NumberFormat("pt-BR").format(total)}</span> {total === 1 ? "registro" : "registros"}</p>
          {me.roles.includes("admin") && <a className={btnGhost} href="/admin/exportar/registro" download><Download size={15} aria-hidden /> Exportar</a>}
        </div>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Hoje", stats.today], ["Últimos 7 dias", stats.week], ["Pessoas ativas hoje", stats.people], ["Automáticos hoje", stats.system]].map(([l, v]) => (
          <div key={l as string} className={`${panelCls} px-4 py-3`}><p className="text-xs text-muted">{l}</p><p className="figure display text-2xl">{new Intl.NumberFormat("pt-BR").format(v as number)}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Filtro rápido por tipo">
        <Link href={typeHref("")} className={`rounded-full border px-3 py-1 text-xs font-medium ${!f.type ? "border-accent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}>Tudo</Link>
        {types.map(([k, l]) => <Link key={k} href={typeHref(k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${f.type === k ? "border-accent bg-grad text-on-accent" : "border-line hover:bg-sunk"}`}>{l}</Link>)}
      </div>
      <Suspense fallback={null}><AuditFilters people={people} types={types} /></Suspense>

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="space-y-2">
          <h2 className="display flex items-baseline gap-2 text-lg">{label(day)} <span className="figure text-xs font-normal text-muted">{plural(list.reduce((a, g) => a + g.rows.length, 0), "registro", "registros")}</span></h2>
          <ul className="space-y-2">
            {list.map((g) => {
              const first = g.rows[0];
              const many = g.rows.length > 1;
              const fields = [...new Set(g.rows.map((r) => r.field).filter(Boolean))];
              const Icon = ICON[first.entity] ?? FileText;
              return (
                <li key={g.key} className={`${panelCls} overflow-hidden`}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 text-sm transition hover:bg-sunk/50 [&::-webkit-details-marker]:hidden">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${TONE[first.entity] ?? "bg-sunk"}`}><Icon size={17} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {first.userName ? <PersonBubble userId={first.userId} name={first.userName} hex={bubbleHex(first.userAccent, first.userId ?? 0, first.userRoles ?? undefined)} /> : <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Sistema</span>}
                          <span className="font-medium">{many ? `${plural(g.rows.length, "alteração", "alterações")}` : first.action}{!many && first.field ? ` · ${first.field}` : ""}</span>
                          {first.company && <span className="truncate text-muted">· {first.company}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{ENTITY_LABEL[first.entity] ?? first.entity}{many && fields.length ? ` · ${fields.slice(0, 6).join(" · ")}${fields.length > 6 ? ` · +${fields.length - 6}` : ""}` : ""}</span>
                      </span>
                      <time className="figure shrink-0 text-xs text-muted">{hourFmt.format(first.at)}</time>
                    </summary>
                    <div className="divide-y divide-line border-t border-line bg-sunk/30 text-sm">
                      {g.rows.map((r) => (
                        <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p><b>{r.action}</b>{r.field ? <span className="text-muted"> · {r.field}</span> : null} <span className="text-xs text-muted">· {fmtDateTimeSec(r.at)}</span></p>
                            {(r.oldValue != null || r.newValue != null) && (
                              <p className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="max-w-full break-words rounded-md bg-danger/10 px-2 py-0.5 text-danger line-through">{r.oldValue ?? "vazio"}</span>
                                <ArrowRight size={13} className="text-muted" aria-hidden />
                                <span className="max-w-full break-words rounded-md bg-ok/10 px-2 py-0.5 text-ok">{r.newValue ?? "vazio"}</span>
                              </p>
                            )}
                            {describeMeta(r.meta).length > 0 && <p className="flex flex-wrap gap-1.5 text-xs">{describeMeta(r.meta).map((m) => <span key={m.label} className="rounded-md bg-sunk px-2 py-0.5 text-muted"><span className="font-medium text-ink">{m.label}:</span> {m.value}</span>)}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {r.leadId && <Link className={btnGhost} href={`/leads/${r.leadId}`}><ExternalLink size={14} aria-hidden /> Abrir lead</Link>}
                            {me.permissions["audit.revert"] && r.leadId && <RevertButton id={r.id} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {rows.length === 0 && <div className={`${panelCls} p-10 text-center text-muted`}>Nenhum registro com esses filtros.</div>}
      <Pagination page={f.page} pages={pages} href={href} />
    </div>
  );
}
