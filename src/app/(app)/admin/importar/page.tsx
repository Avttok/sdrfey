import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";
import { requireAdmin } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Importar" };

export default async function Page() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div><h1 className="display text-3xl">Importar CSV</h1><p className="mt-1 text-muted">Adicione leads ou representantes ao banco em 3 passos. Nada que já existe é sobrescrito.</p></div>
      <ImportForm />
    </div>
  );
}
