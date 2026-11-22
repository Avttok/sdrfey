import type { Metadata } from "next";
import { Filter } from "lucide-react";
import { ListFlow } from "@/components/list-flow";
import { PageHead } from "@/components/page-head";
import { TAG } from "@/config/tags";
import { requirePerm } from "@/modules/auth/guard";
import { listsUsed, myLists } from "@/modules/lists/queries";
import { getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Lista Flow" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.lista_flow");
  const [lists, catalog, used] = await Promise.all([myLists(me.id, "sdr"), getTagCatalog(), listsUsed(me.id)]);
  const groups = catalog.filter((g) => g.key === TAG.group.porte || g.key === TAG.group.capital).map((g) => ({ key: g.key, name: g.name, tags: g.tags.map((t) => ({ key: t.key, label: t.label })) }));
  return <div className="space-y-5"><PageHead icon={Filter} size="md" title="Lista Flow" /><p className="max-w-2xl text-sm text-muted">Monte uma lista de leads do jeito que você conhece (região, tipo de empresa, quanta informação já tem). Com uma lista ativa, o Shuffler ganha o botão “Sortear da lista”.</p><ListFlow used={used} kind="sdr" lists={lists} tagGroups={groups} /></div>;
}
