import { Users } from "lucide-react";
import { ContactsImport } from "@/components/admin/contacts-import";
import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/modules/auth/guard";

export const metadata = { title: "Importar contatos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  return <div className="space-y-5"><PageHead icon={Users} size="md" title="Importar contatos" subtitle="Pessoas de cada empresa, com cargo, telefone e e-mail, ligadas ao lead pelo CNPJ." /><ContactsImport /></div>;
}
