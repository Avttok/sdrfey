import { asc } from "drizzle-orm";
import { PhoneCall } from "lucide-react";
import { RoteiroSwitch } from "@/components/admin/roteiro-switch";
import { VocallAdmin } from "@/components/admin/vocall-admin";
import { PageHead } from "@/components/page-head";
import { db, users } from "@/db";
import { getSettings, settingValue } from "@/modules/settings/get";
import { parseVocall, VOCALL_KEY } from "@/modules/vocall/config";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [cfg, rows, st] = await Promise.all([settingValue(VOCALL_KEY), db.select({ id: users.id, name: users.name, agentId: users.vocallAgentId, ramal: users.vocallRamal }).from(users).where(undefined).orderBy(asc(users.name)), getSettings()]);
  return <div className="space-y-5"><PageHead icon={PhoneCall} size="md" title="Ligações (VocallPhone)" /><RoteiroSwitch initial={st.roteiro_on === 1} /><VocallAdmin initial={parseVocall(cfg)} people={rows.map((r) => ({ id: r.id, name: r.name, agentId: r.agentId ?? "", ramal: r.ramal ?? "" }))} /></div>;
}
