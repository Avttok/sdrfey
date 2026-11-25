import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { PerformanceWizard } from "@/components/performance-wizard";
import { requirePerm } from "@/modules/auth/guard";
import { allowedPeople } from "@/modules/performance/access";
import { SECTIONS } from "@/modules/performance/report";

export const metadata: Metadata = { title: "Desempenho" };
export const dynamic = "force-dynamic";

/** Exporta o desempenho em planilha, passo a passo (período → conteúdo → pessoas → prévia → download). */
export default async function PerformancePage() {
  const me = await requirePerm("tab.desempenho");
  const people = await allowedPeople(me, "sdr");
  return (
    <div className="mx-auto w-full min-w-0 max-w-[92rem] space-y-5">
      <PageHead icon={FileSpreadsheet} title="Desempenho" subtitle="Monte uma planilha bonita com seus números para apresentar em reuniões." />
      <PerformanceWizard kind="sdr" sections={SECTIONS.sdr} people={people} team={!!me.permissions["desempenho.equipe"]} />
    </div>
  );
}
