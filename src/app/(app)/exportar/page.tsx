import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { ExportCenter } from "@/components/export-center";
import { panelCls } from "@/components/ui";
import { requirePerm } from "@/modules/auth/guard";
import { allowedDatasets } from "@/modules/export/access";

export const metadata: Metadata = { title: "Exportar" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.exportar");
  const datasets = allowedDatasets(me);
  return (
    <div className="space-y-5">
      <PageHead icon={Download} size="md" title="Exportar" />
      {datasets.length ? <ExportCenter datasets={datasets} canPackage /> : <p className={`${panelCls} p-6 text-center text-sm text-muted`}>O Adm ainda não liberou nenhuma base para você exportar.</p>}
    </div>
  );
}
