import { asc } from "drizzle-orm";
import { Handshake } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { SalesAdmin } from "@/components/admin/sales-admin";
import { db, paymentTerms, products } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [terms, prods] = await Promise.all([db.select().from(paymentTerms).orderBy(asc(paymentTerms.name)), db.select().from(products).orderBy(asc(products.code))]);
  return (
    <div className="space-y-5">
      <PageHead icon={Handshake} size="md" title="Vendas" subtitle="Condições de pagamento e catálogo de produtos usados nas cotações." />
      <SalesAdmin terms={terms.map((t) => ({ id: t.id, name: t.name, active: t.active }))} products={prods.map((p) => ({ id: p.id, code: p.code, description: p.description, kind: p.kind, unit: p.unit, lastUnitCents: p.lastUnitCents, seenCount: p.seenCount }))} />
    </div>
  );
}
