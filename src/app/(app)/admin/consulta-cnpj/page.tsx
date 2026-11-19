import { DatabaseZap } from "lucide-react";
import { EnrichAdmin } from "@/components/admin/enrich-admin";
import { PageHead } from "@/components/page-head";
import { enrichStats } from "@/modules/enrich/batch";
import { liveData } from "@/modules/enrich/live";
import { getSettings } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [stats, s, live] = await Promise.all([enrichStats(), getSettings(), liveData()]);
  return (
    <div className="space-y-5">
      <PageHead icon={DatabaseZap} size="md" title="Consulta de CNPJ" subtitle="Busca os dados na BrasilAPI e na ReceitaWS dos leads que ainda não foram consultados." />
      <EnrichAdmin initial={stats} on={s.auto_enrich === 1} cronReady={!!process.env.CRON_SECRET} live={live} />
    </div>
  );
}
