import { Settings2 } from "lucide-react";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHead } from "@/components/page-head";
import { getSettings } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <div className="space-y-5">
      <PageHead icon={Settings2} size="md" title="Parâmetros" subtitle="As regras que decidem quando um lead volta ao sorteio." />
      <SettingsForm initial={await getSettings()} />
    </div>
  );
}
