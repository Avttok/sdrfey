import type { Metadata } from "next";
import { Pagination } from "@/components/pagination";
import Link from "next/link";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Map, MapPin, UserCheck, Users } from "lucide-react";
import { Suspense } from "react";
import { PageHead } from "@/components/page-head";
import { RepFilters } from "@/components/rep-filters";
import { NewRepButton, RepsAdmin } from "@/components/reps-admin";
import { btnGhost, panelCls } from "@/components/ui";
import { db, reps, visits } from "@/db";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Representantes" };
export const dynamic = "force-dynamic";
const PAGE = 25;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.representantes");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() || undefined : undefined);
  const page = Math.max(1, Number(one("page")) || 1);
  const c: SQL[] = [];
  const q = one("q");
  if (q) { const like = `%${q.replace(/[%_]/g, "")}%`; c.push(or(ilike(reps.repName, like), ilike(reps.sapCode, like), ilike(reps.city, like), ilike(reps.managerName, like), ilike(reps.team, like), ilike(reps.cnpj, like))!); }
  if (one("uf")) c.push(eq(reps.uf, one("uf")!));
  if (one("team")) c.push(eq(reps.team, one("team")!));
  if (one("manager")) c.push(eq(reps.managerName, one("manager")!));
  if (one("status") === "ativo") c.push(eq(reps.active, true));
  if (one("status") === "inativo") c.push(eq(reps.active, false));
  const where = c.length ? and(...c) : undefined;

  const visitCount = sql`(select count(*) from visits v where v.rep_sap = ${reps.sapCode} and v.canceled_at is null)`;
  const sort = one("sort");
  const order = sort === "visitas-desc" ? [sql`${visitCount} desc`, asc(reps.repName)] : sort === "visitas-asc" ? [sql`${visitCount} asc`, asc(reps.repName)] : [asc(reps.repName)];
  const distinct = async (col: typeof reps.uf | typeof reps.team | typeof reps.managerName) =>
    (await db.selectDistinct({ v: col }).from(reps).orderBy(asc(col))).map((r) => r.v).filter((v): v is string => !!v);
  const [rows, [{ n }], [tot], ufs, teams, managers] = await Promise.all([
    db.select().from(reps).where(where).orderBy(...order).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(reps).where(where),
    db.select({ n: sql<number>`count(*)::int`, ativos: sql<number>`count(*) filter (where ${reps.active})::int`, ufs: sql<number>`count(distinct ${reps.uf})::int` }).from(reps),
    distinct(reps.uf), distinct(reps.team), distinct(reps.managerName),
  ]);
  const saps = rows.map((r) => r.sapCode);
  const vis = saps.length ? await db.select({ sap: visits.repSap, n: sql<number>`count(*)::int`, last: sql<string | null>`max(${visits.createdAt})::text` }).from(visits).where(and(sql`${visits.repSap} in (${sql.join(saps.map((x) => sql`${x}`), sql`, `)})`, sql`${visits.canceledAt} is null`)).groupBy(visits.repSap) : [];
  const pages = Math.max(1, Math.ceil(n / PAGE));
  const href = (p: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") u.set(k, v); u.set("page", String(p)); return `/representantes?${u}`; };
  const nf = new Intl.NumberFormat("pt-BR");
  return (
    <div className="space-y-5">
      <PageHead icon={MapPin} title="Representantes">{me.permissions["rep.edit"] && <NewRepButton />}</PageHead>
      <div className="grid grid-cols-3 gap-3">
        {([["Cadastrados", tot.n, Users], ["Ativos", tot.ativos, UserCheck], ["Estados", tot.ufs, Map]] as const).map(([l, v, I], i) => (
          <div key={l} style={{ "--i": i } as React.CSSProperties} className={`${panelCls} stat-glow card-in flex items-center gap-3 p-4`}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-grad-soft text-accent"><I size={18} aria-hidden /></span><div><p className="text-xs text-muted">{l}</p><p className="figure text-2xl font-bold leading-tight">{nf.format(v)}</p></div></div>
        ))}
      </div>
      <Suspense fallback={null}><RepFilters ufs={ufs} teams={teams} managers={managers} /></Suspense>
      <p className="text-sm font-medium text-muted">{nf.format(n)} {n === 1 ? "representante" : "representantes"}{c.length ? " com esses filtros" : ""}</p>
      <RepsAdmin isAdmin={me.isAdmin} canEdit={!!me.permissions["rep.edit"]} rows={rows.map((r) => ({ id: r.id, sapCode: r.sapCode, repName: r.repName ?? "", managerName: r.managerName ?? "", team: r.team ?? "", cnpj: r.cnpj ?? "", address: r.address ?? "", cep: r.cep ?? "", city: r.city ?? "", uf: r.uf ?? "", active: r.active, visits: vis.find((v) => v.sap === r.sapCode)?.n ?? 0, lastVisit: vis.find((v) => v.sap === r.sapCode)?.last ?? null }))} />
      <Pagination page={page} pages={pages} href={href} />
    </div>
  );
}
