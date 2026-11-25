import type { Metadata } from "next";
import { Filter } from "lucide-react";
import { ListFlow } from "@/components/list-flow";
import { PageHead } from "@/components/page-head";
import { TAG } from "@/config/tags";
import { requirePerm } from "@/modules/auth/guard";
import { listsUsed, myLists, sharedLists } from "@/modules/lists/queries";
import { getTagCatalog } from "@/modules/leads/view";

export const metadata: Metadata = { title: "Lista Flow" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.lista_flow_vendas");
  const [lists, catalog, used, shared] = await Promise.all([myLists(me.id, "vendas"), getTagCatalog(), listsUsed(me.id), sharedLists(me.id, "vendas")]);
  const groups = catalog.filter((g) => [TAG.group.porte, TAG.group.capital, TAG.group.temperatura, TAG.group.qualificacao, TAG.group.situacao].includes(g.key as never)).map((g) => ({ key: g.key, name: g.name, tags: g.tags.map((t) => ({ key: t.key, label: t.label })) }));
  return <div className="space-y-5"><PageHead icon={Filter} size="md" title="Lista Flow" /><p className="max-w-2xl text-sm text-muted">Monte uma lista de leads do jeito que você conhece (região, tipo de empresa, quanta informação já tem). Com uma lista ativa, o Shuffler ganha o botão “Sortear da lista”.</p><ListFlow used={used} shared={shared} kind="vendas" lists={lists} tagGroups={groups} /></div>;
}
