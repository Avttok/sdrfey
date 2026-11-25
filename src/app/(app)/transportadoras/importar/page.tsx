import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { CarrierImportForm } from "@/components/carrier-import-form";
import { PageHead } from "@/components/page-head";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Importar transportadoras" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePerm("carriers.edit");
  return (
    <div className="space-y-5">
      <PageHead icon={Truck} hex="#f59e0b" title="Importar transportadoras" />
      <CarrierImportForm />
    </div>
  );
}
