import { desc, eq } from "drizzle-orm";
import { Brain } from "lucide-react";
import { FieldsAdmin } from "@/components/admin/fields-admin";
import { PageHead } from "@/components/page-head";
import { db, fieldSuggestions } from "@/db";
import { fieldStats } from "@/modules/facts/intel";
import { fieldCatalog } from "@/modules/facts/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dados dos leads" };

export default async function Page() {
  const [defs, stats, sugs] = await Promise.all([fieldCatalog(true), fieldStats(), db.select().from(fieldSuggestions).where(eq(fieldSuggestions.status, "pendente")).orderBy(desc(fieldSuggestions.evidence))]);
  return (
    <div className="space-y-5">
      <PageHead icon={Brain} size="md" title="Dados dos leads" subtitle="Os campos que os roteiros preenchem durante a ligação. O sistema mede o que funciona e sugere o que falta." />
      <FieldsAdmin defs={defs} stats={stats} suggestions={sugs.map((s) => ({ id: s.id, label: s.label, kind: s.kind, scope: s.scope, evidence: s.evidence, examples: s.examples ?? [], options: s.options ?? [] }))} />
    </div>
  );
}
