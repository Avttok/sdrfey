import { channelsFor } from "@/modules/chat/channels";
import { chatEnabled, unreadByChannel } from "@/modules/chat/data";
import type { CurrentUser } from "@/modules/auth/guard";
import { ChatWidget } from "./chat-widget";

/** Botão flutuante do chat (canto inferior direito). Some se o Adm desligar o chat ou a conta não tiver a permissão. */
export async function ChatMount({ user }: { user: CurrentUser }) {
  if (!(await chatEnabled(user))) return null;
  const unread = await unreadByChannel(user).catch(() => ({}));
  return <ChatWidget myName={user.name} channels={channelsFor(user.roles)} meId={user.id} isAdmin={user.roles.includes("admin")} initialUnread={unread} />;
}
