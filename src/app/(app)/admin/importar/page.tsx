import type { Metadata } from "next";
import { Upload } from "lucide-react";
import { ImportForm } from "@/components/import-form";
import { PageHead } from "@/components/page-head";
import { ImportHistory } from "@/components/import-history";
import { importHistory } from "@/modules/import/history";
import { requireAdmin } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Importar" };

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  const history = await importHistory();
  return (
    <div className="space-y-5">
      <PageHead icon={Upload} size="md" title="Importar CSV" />
      <ImportForm />
      <ImportHistory rows={history} />
    </div>
  );
}
