import { BarChart3 } from "lucide-react";
import { UsageView } from "@/components/admin/script-usage";
import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/modules/auth/guard";
import { scriptUsage } from "@/modules/scripts/usage";

export const dynamic = "force-dynamic";

/** Uso dos roteiros: só o Adm vê. Filtros ficam na própria URL. */
export default async function Page({ searchParams }: { searchParams: Promise<{ dias?: string; user?: string; testes?: string }> }) {
  await requireAdmin();
  const q = await searchParams;
  const days = Number(q.dias); const userId = Number(q.user);
  const f = { days: days > 0 ? days : null, userId: userId > 0 ? userId : null, withTests: q.testes === "1" };
  const data = await scriptUsage(f);
  return <div className="space-y-5"><PageHead icon={BarChart3} hex="#14b8a6" title="Uso dos roteiros" /><UsageView data={data} days={f.days} userId={f.userId} withTests={f.withTests} /></div>;
}
