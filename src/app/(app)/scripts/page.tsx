import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { ScriptsView } from "@/components/scripts-view";
import { fieldCatalog } from "@/modules/facts/queries";
import { requirePerm } from "@/modules/auth/guard";
import { listScripts } from "@/modules/scripts/list";

export const metadata: Metadata = { title: "Scripts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePerm("tab.scripts");
  const scripts = await listScripts(me.id, { all: me.isAdmin });
  return <div className="space-y-5"><PageHead icon={ScrollText} size="md" title="Scripts de ligação" /><p className="max-w-2xl text-sm text-muted">Roteiros interativos: leia a fala, toque na resposta do lead e o script avança. Treine aqui, use no Shuffler e crie os seus (marcados com ★).</p><ScriptsView fields={await fieldCatalog()} scripts={scripts} isAdmin={me.isAdmin} myName={me.name} /></div>;
}
