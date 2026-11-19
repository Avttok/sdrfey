import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/guard";
import { canAccessChannel } from "@/modules/chat/channels";
import { chatEnabled, deletedSince, dmList, listMessages, markRead, reactionsSince, takeMentions, unreadByChannel } from "@/modules/chat/data";

export const dynamic = "force-dynamic";

/** Consulta do chat: mensagens novas (after), anteriores (before) e não lidas de todos os canais. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ error: "login" }, { status: 401 });
  if (!(await chatEnabled(me))) return NextResponse.json({ enabled: false, unread: {}, messages: [], gone: [], reactions: {} });
  const q = req.nextUrl.searchParams;
  const channel = q.get("channel");
  const num = (k: string) => { const n = Number(q.get(k)); return Number.isInteger(n) && n > 0 ? n : undefined; };
  let messages: Awaited<ReturnType<typeof listMessages>> = [];
  let gone: number[] = [];
  let reactions: Awaited<ReturnType<typeof reactionsSince>> = {};
  if (channel && canAccessChannel(me, channel)) {
    const after = num("after"), before = num("before");
    messages = await listMessages(me, channel, { after, before });
    const from = num("from");
    if (from && after) [gone, reactions] = await Promise.all([deletedSince(channel, from), reactionsSince(me, channel, from)]);
    if (q.get("open") === "1" && (!after || messages.length || q.get("mark") === "1")) await markRead(me, channel, Math.max(after ?? 0, ...messages.map((m) => m.id)));
  }
  const [unread, dms, mentions] = await Promise.all([unreadByChannel(me), dmList(me), takeMentions(me)]);
  return NextResponse.json({ enabled: true, unread, dms, mentions, messages, gone, reactions }, { headers: { "Cache-Control": "no-store" } });
}
