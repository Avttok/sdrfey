import { desc, eq } from "drizzle-orm";
import { Brain } from "lucide-react";
import { FieldsAdmin } from "@/components/admin/fields-admin";
import { PageHead } from "@/components/page-head";
import { db, fieldSuggestions } from "@/db";
import { fieldStats, topEnrichers } from "@/modules/facts/intel";
import { fieldCatalog } from "@/modules/facts/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dados dos leads" };

export default async function Page() {
  const [defs, stats, top, sugs] = await Promise.all([fieldCatalog(true), fieldStats(), topEnrichers(), db.select().from(fieldSuggestions).where(eq(fieldSuggestions.status, "pendente")).orderBy(desc(fieldSuggestions.evidence))]);
  return (
    <div className="space-y-5">
      <PageHead icon={Brain} hex="#0ea5e9" title="Dados dos leads" subtitle="Os campos que os roteiros preenchem durante a ligação. O sistema mede o que funciona e sugere o que falta." />
      {top.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4" aria-label="Quem mais enriquece os leads">
          <h2 className="mb-2 text-sm font-semibold">Quem mais enriquece os leads</h2>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {top.map((t, i) => <li key={t.id} className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm"><span className="figure w-5 text-muted">{i + 1}º</span><span className="flex-1 font-medium">{t.name}</span><span className="figure">{t.facts} dados</span><span className="text-xs text-muted">em {t.leads} leads</span></li>)}
          </ol>
        </section>
      )}
      <FieldsAdmin defs={defs} stats={stats} suggestions={sugs.map((s) => ({ id: s.id, label: s.label, kind: s.kind, scope: s.scope, evidence: s.evidence, examples: s.examples ?? [], options: s.options ?? [] }))} />
    </div>
  );
}
