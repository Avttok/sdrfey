import { BookA } from "lucide-react";
import { GlossaryAdmin } from "@/components/admin/glossary-admin";
import { PageHead } from "@/components/page-head";
import { getTermOverrides } from "@/modules/terms/get";
import { listSwaps } from "@/modules/terms/list";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [overrides, swaps] = await Promise.all([getTermOverrides(), listSwaps().catch(() => [])]);
  return <div className="space-y-5"><PageHead icon={BookA} hex="#a855f7" title="Glossário" subtitle="Os nomes do sistema em um só lugar: renomeie na tela e troque textos já gravados." /><GlossaryAdmin initial={overrides} swaps={swaps} /></div>;
}
