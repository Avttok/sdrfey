import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { listNotifications } from "@/modules/notifications/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  return NextResponse.json(await listNotifications(me.id), { headers: { "Cache-Control": "no-store" } });
}
