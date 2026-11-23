import { Merge } from "lucide-react";
import { DuplicatesAdmin } from "@/components/admin/duplicates-admin";
import { PageHead } from "@/components/page-head";
import { findDuplicatesAction } from "@/modules/facts/contacts";

export const metadata = { title: "Contatos repetidos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const groups = await findDuplicatesAction();
  return <div className="space-y-5"><PageHead icon={Merge} size="md" title="Contatos repetidos" subtitle="Pessoas que aparecem duas vezes na mesma empresa (mesmo nome ou mesmo telefone/e-mail). Junte para não perder nada." /><DuplicatesAdmin groups={groups} /></div>;
}
