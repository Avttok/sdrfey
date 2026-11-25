import { eq } from "drizzle-orm";
import { Headset } from "lucide-react";
import { WebPhoneTest } from "@/components/admin/web-phone-test";
import { PageHead } from "@/components/page-head";
import { db, users } from "@/db";
import { requireAdmin } from "@/modules/auth/guard";
import { settingValue } from "@/modules/settings/get";
import { parseVocall, VOCALL_KEY } from "@/modules/vocall/config";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireAdmin();
  const cfg = parseVocall(await settingValue(VOCALL_KEY));
  const [u] = await db.select({ a: users.vocallAgentId, r: users.vocallRamal }).from(users).where(eq(users.id, me.id));
  return (
    <div className="space-y-5">
      <PageHead icon={Headset} hex="#3b82f6" title="Telefone no navegador (teste)" />
      <WebPhoneTest cfg={{ host: cfg.host, port: cfg.port, secure: cfg.secure, dac: cfg.dac, senha: cfg.senha, prefix: cfg.prefix }} agentId={u?.a ?? ""} ramal={u?.r ?? ""} />
    </div>
  );
}
