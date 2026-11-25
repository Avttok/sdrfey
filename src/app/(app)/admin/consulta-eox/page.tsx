import { Plug } from "lucide-react";
import { EoxConsultAdmin } from "@/components/admin/eox-consult-admin";
import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/modules/auth/guard";
import { loadConsultOptions } from "@/modules/eox/consult";
import { eoxDock } from "@/modules/eox/consult-daemon";
import { eoxReady } from "@/modules/eox/config";
import { loadEox } from "@/modules/eox/sync";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireAdmin();
  const [dock, cfg, options] = await Promise.all([eoxDock(me), loadEox(), loadConsultOptions()]);
  return (
    <div className="space-y-5">
      <PageHead icon={Plug} hex="#8b5cf6" title="Consulta EOX" subtitle="Procura cada lead na EOX pelo CNPJ e completa telefones, e-mails, pessoas de contato e endereço." />
      <EoxConsultAdmin initial={dock} ready={eoxReady(cfg)} options={options} />
    </div>
  );
}
