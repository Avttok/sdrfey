import { Link2 } from "lucide-react";
import { EoxHub } from "@/components/admin/eox-hub";
import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/modules/auth/guard";
import { eoxCoverage } from "@/modules/eox/actions";
import { eoxReady } from "@/modules/eox/config";
import { loadEox } from "@/modules/eox/sync";
import { importHistory } from "@/modules/import/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Page() {
  await requireAdmin();
  const [cfg, cov, hist] = await Promise.all([loadEox(), eoxCoverage(), importHistory(60)]);
  // a chave de acesso nunca sai do servidor
  return <div className="space-y-5"><PageHead icon={Link2} size="md" title="Integração com a EOX" subtitle="Códigos dos clientes, retrato da EOX, importação das planilhas e conexão com a API." /><EoxHub cfg={{ ...cfg, accessKey: "" }} hasKey={!!cfg.accessKey} coverage={cov} history={hist} ready={eoxReady(cfg)} /></div>;
}
