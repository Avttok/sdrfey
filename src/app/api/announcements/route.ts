import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { activeAnnouncements } from "@/modules/announcements/active";

export const dynamic = "force-dynamic";

/** Avisos globais ativos para a pessoa logada. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ items: [] }, { status: 401 });
  return NextResponse.json({ items: await activeAnnouncements(me.roles, me.isAdmin) }, { headers: { "Cache-Control": "no-store" } });
}
