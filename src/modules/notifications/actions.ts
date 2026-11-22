"use server";

import { z } from "zod";
import { requireUser } from "@/modules/auth/guard";
import { clearRead, markRead } from "./notify";

export async function markNotificationsAction(ids: number[] | "all"): Promise<void> {
  const me = await requireUser();
  const p = z.union([z.literal("all"), z.array(z.number().int()).max(100)]).safeParse(ids);
  if (p.success) await markRead(me.id, p.data);
}
export async function clearNotificationsAction(): Promise<void> {
  const me = await requireUser();
  await clearRead(me.id);
}
