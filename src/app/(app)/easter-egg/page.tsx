import { notFound } from "next/navigation";
import { EggGame } from "@/components/easter-egg";
import { requireUser } from "@/modules/auth/guard";
import { eggHasKey, eggIsDone } from "@/modules/easter/actions";

export const dynamic = "force-dynamic";

/** Porta secreta: sem a chave (cookie curto) a página simplesmente não existe. */
export default async function Page() {
  const me = await requireUser();
  if (!(await eggHasKey(me.id))) notFound();
  return <EggGame done={await eggIsDone(me.id)} />;
}
