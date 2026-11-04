import { getSettings } from "@/modules/settings/get";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function Page() {
  return <SettingsForm initial={await getSettings()} />;
}
