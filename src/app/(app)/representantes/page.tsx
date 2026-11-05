import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Suspense } from "react";
import { RepFilters } from "@/components/rep-filters";
import { RepsAdmin } from "@/components/reps-admin";
import { btnGhost, panelCls } from "@/components/ui";
import { db, reps } from "@/db";
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

  const distinct = async (col: typeof reps.uf | typeof reps.team | typeof reps.managerName) =>
    (await db.selectDistinct({ v: col }).from(reps).orderBy(asc(col))).map((r) => r.v).filter((v): v is string => !!v);
  const [rows, [{ n }], [tot], ufs, teams, managers] = await Promise.all([
    db.select().from(reps).where(where).orderBy(asc(reps.repName)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(reps).where(where),
    db.select({ n: sql<number>`count(*)::int`, ativos: sql<number>`count(*) filter (where ${reps.active})::int`, ufs: sql<number>`count(distinct ${reps.uf})::int` }).from(reps),
    distinct(reps.uf), distinct(reps.team), distinct(reps.managerName),
  ]);
  const pages = Math.max(1, Math.ceil(n / PAGE));
  const href = (p: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") u.set(k, v); u.set("page", String(p)); return `/representantes?${u}`; };
  const nf = new Intl.NumberFormat("pt-BR");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-3xl">Representantes</h1>
        <p className="mt-1 text-sm text-muted">O representante mais próximo de cada lead é calculado pela cidade (distância em linha reta).</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([["Cadastrados", tot.n], ["Ativos", tot.ativos], ["Estados", tot.ufs]] as const).map(([l, v]) => <div key={l} className={`${panelCls} p-4`}><p className="text-xs text-muted">{l}</p><p className="figure mt-1 text-2xl">{nf.format(v)}</p></div>)}
      </div>
      <Suspense fallback={null}><RepFilters ufs={ufs} teams={teams} managers={managers} /></Suspense>
      <p className="text-sm font-medium">{nf.format(n)} {n === 1 ? "representante" : "representantes"}{c.length ? " com esses filtros" : ""}</p>
      <RepsAdmin isAdmin={me.roles.includes("admin")} canEdit={!!me.permissions["rep.edit"]} rows={rows.map((r) => ({ id: r.id, sapCode: r.sapCode, repName: r.repName ?? "", managerName: r.managerName ?? "", team: r.team ?? "", cnpj: r.cnpj ?? "", address: r.address ?? "", cep: r.cep ?? "", city: r.city ?? "", uf: r.uf ?? "", active: r.active }))} />
      {pages > 1 && <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">{page > 1 && <Link className={btnGhost} href={href(page - 1)}>Anterior</Link>}<span>Página {page} de {pages}</span>{page < pages && <Link className={btnGhost} href={href(page + 1)}>Próxima</Link>}</nav>}
    </div>
  );
}
