import type { Metadata } from "next";
import { Upload } from "lucide-react";
import { ImportForm } from "@/components/import-form";
import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Importar" };

export default async function Page() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <PageHead icon={Upload} size="md" title="Importar CSV" subtitle="Adicione leads ou representantes em 3 passos. Nada que já existe é sobrescrito." />
      <ImportForm />
    </div>
  );
}
