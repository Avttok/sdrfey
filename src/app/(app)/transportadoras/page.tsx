import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Truck } from "lucide-react";
import { CarriersView } from "@/components/carriers-view";
import { PageHead } from "@/components/page-head";
import { carriers, db } from "@/db";
import type { CarrierRow, FreightMode } from "@/config/carriers";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Transportadoras" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.transportadoras");
  const rows = await db.select().from(carriers).orderBy(asc(carriers.uf), asc(carriers.mode), asc(carriers.name));
  const list: CarrierRow[] = rows.map((r) => ({ id: r.id, uf: r.uf, mode: r.mode as FreightMode, name: r.name, capitalPct: r.capitalPct, interiorPct: r.interiorPct, capitalDays: r.capitalDays, interiorDays: r.interiorDays, minCents: r.minCents, contact: r.contact, note: r.note, active: r.active }));
  return <div className="space-y-5"><PageHead icon={Truck} title="Transportadoras" subtitle="Estado, tipo de frete (CIF, FOB ou redespacho), % de frete na capital e no interior e prazo estimado. Use a calculadora para comparar o frete de um pedido." hex="#f59e0b" /><CarriersView rows={list} canEdit={me.isAdmin || !!me.permissions["carriers.edit"]} /></div>;
}
