import { redirect } from "next/navigation";
import { visibleNav } from "@/config/nav";
import { requireUser } from "@/modules/auth/guard";

/** Leva a pessoa para a primeira aba que ela pode ver. */
export default async function Home() {
  const user = await requireUser();
  redirect(visibleNav(user.permissions, user.isAdmin)[0]?.href ?? "/conta");
}
