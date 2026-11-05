import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { RepsAdmin } from "@/components/reps-admin";
import { db, reps } from "@/db";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Representantes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.representantes");
  const rows = await db.select().from(reps).orderBy(asc(reps.repName));
  return (
    <div className="space-y-4">
      <h1 className="display text-3xl">Representantes</h1>
      <p className="text-sm text-muted">{rows.length} cadastrados. O representante mais próximo de cada lead é calculado pela cidade (distância em linha reta).</p>
      <RepsAdmin isAdmin={me.roles.includes("admin")} canEdit={!!me.permissions["rep.edit"]} rows={rows.map((r) => ({ id: r.id, sapCode: r.sapCode, repName: r.repName ?? "", managerName: r.managerName ?? "", team: r.team ?? "", cnpj: r.cnpj ?? "", address: r.address ?? "", cep: r.cep ?? "", city: r.city ?? "", uf: r.uf ?? "", active: r.active }))} />
    </div>
  );
}
