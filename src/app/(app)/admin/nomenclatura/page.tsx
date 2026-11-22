import { asc } from "drizzle-orm";
import { Tags } from "lucide-react";
import { TermsAdmin } from "@/components/admin/terms-admin";
import { PageHead } from "@/components/page-head";
import { db, productTerms, products } from "@/db";
import { settingValue } from "@/modules/settings/get";
import { classifyProduct, findUnknownTerms } from "@/modules/products/classify";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [terms, prods, recos] = await Promise.all([db.select().from(productTerms).orderBy(asc(productTerms.category), asc(productTerms.code)), db.select({ description: products.description }).from(products), settingValue("segment_recos")]);
  const active = terms.filter((t) => t.active);
  const uses = new Map<string, number>();
  for (const p of prods) for (const t of classifyProduct(p.description, active)) uses.set(t.code, (uses.get(t.code) ?? 0) + 1);
  return (
    <div className="space-y-5">
      <PageHead icon={Tags} size="md" title="Nomenclatura de produtos" />
      <TermsAdmin terms={terms.map((t) => ({ id: t.id, code: t.code, meaning: t.meaning, category: t.category, note: t.note, active: t.active, uses: uses.get(t.code) ?? 0 }))} unknown={findUnknownTerms(prods.map((p) => p.description), terms.map((t) => t.code))} recos={(recos ?? {}) as Record<string, string[]>} />
    </div>
  );
}
