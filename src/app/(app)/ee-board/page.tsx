import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EggBoard } from "@/components/egg-board";
import { requireUser } from "@/modules/auth/guard";
import { hasEgg } from "@/modules/achievements/stats";

export const metadata: Metadata = { title: "Estive aqui" };
export const dynamic = "force-dynamic";

/** Mural de post-its do Douradovo. Só quem já encontrou o segredo entra. */
export default async function Page() {
  const me = await requireUser();
  if (!(await hasEgg(me.id))) redirect("/painel");
  return <EggBoard />;
}
