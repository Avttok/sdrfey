import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Importar" };

export default async function Page() {
  await requirePerm("tab.importar");
  return (
    <div className="space-y-4">
      <h1 className="display text-3xl">Importar CSV</h1>
      <ImportForm />
    </div>
  );
}
