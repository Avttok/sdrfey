import { Merge } from "lucide-react";
import { DuplicatesAdmin } from "@/components/admin/duplicates-admin";
import { PageHead } from "@/components/page-head";
import { findDuplicateSetsAction } from "@/modules/facts/contacts";

export const metadata = { title: "Contatos repetidos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const sets = await findDuplicateSetsAction();
  return <div className="space-y-5"><PageHead icon={Merge} size="md" title="Contatos repetidos" subtitle="Pessoas que aparecem duas vezes na mesma empresa. Veja quem fica, quem será juntado e o que sobra, e junte sem perder telefone nem dados." /><DuplicatesAdmin sets={sets} /></div>;
}
