import { Link2 } from "lucide-react";
import { EoxImport } from "@/components/admin/eox-import";
import { EoxAdmin } from "@/components/admin/eox-admin";
import { PageHead } from "@/components/page-head";
import { eoxCoverage } from "@/modules/eox/actions";
import { loadEox, loadSyncState } from "@/modules/eox/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Page() {
  const [cfg, st, cov] = await Promise.all([loadEox(), loadSyncState(), eoxCoverage()]);
  // a chave de acesso nunca sai do servidor
  return <div className="space-y-5"><PageHead icon={Link2} size="md" title="Integração com a EOX" /><EoxAdmin initial={{ ...cfg, accessKey: "" }} hasKey={!!cfg.accessKey} sync={st} coverage={cov} /><EoxImport /></div>;
}
