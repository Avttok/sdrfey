import type { Metadata } from "next";
import { and, asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { DealImportForm } from "@/components/deals/deal-import-form";
import { PageHead } from "@/components/page-head";
import { db, users } from "@/db";
import { requirePerm } from "@/modules/auth/guard";
import { visibleUsers } from "@/modules/auth/visibility";

export const metadata: Metadata = { title: "Importar negociações" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.negociacoes");
  const team = !!me.permissions["deals.team"];
  if (!me.roles.includes("seller") && !team) redirect("/negociacoes");
  const sellers = team ? await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), sql`'seller' = any(${users.roles})`, visibleUsers(me))).orderBy(asc(users.name)) : null;
  return (
    <div className="space-y-5">
      <PageHead icon={FileSpreadsheet} title="Importar minhas negociações" subtitle="Traga clientes e negociações da sua planilha para o sistema, sem duplicar nada." />
      <DealImportForm sellers={sellers} />
    </div>
  );
}
