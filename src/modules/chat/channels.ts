import type { Role } from "@/config/roles";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"] as const;
export type ChannelKey = "geral" | "user" | "seller" | "manager";
export const CHANNELS: { key: ChannelKey; label: string; hint: string }[] = [
  { key: "geral", label: "Geral", hint: "Todos do sistema" },
  { key: "user", label: "SDR", hint: "Só quem é SDR" },
  { key: "seller", label: "Vendas", hint: "Só quem é de Vendas" },
  { key: "manager", label: "Gestores", hint: "Só quem é Gestor" },
];

/** Canais que a conta acessa: o Geral e o grupo de cada cargo dela. O Adm acessa todos. */
export function channelsFor(roles: readonly Role[]): { key: ChannelKey; label: string; hint: string }[] {
  const admin = roles.includes("admin");
  return CHANNELS.filter((c) => c.key === "geral" || admin || roles.includes(c.key as Role));
}
export const canUseChannel = (roles: readonly Role[], key: string) => channelsFor(roles).some((c) => c.key === key);

/* ───── Conversas privadas (DM): canal "dm:<menor id>-<maior id>" ───── */
export const dmKey = (a: number, b: number) => `dm:${Math.min(a, b)}-${Math.max(a, b)}`;
export function parseDm(key: string): [number, number] | null {
  const m = /^dm:(\d+)-(\d+)$/.exec(key);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
/** Com quem `meId` conversa nesse canal privado (null se não for dele). */
export function dmOther(key: string, meId: number): number | null {
  const p = parseDm(key);
  return p && (p[0] === meId || p[1] === meId) ? (p[0] === meId ? p[1] : p[0]) : null;
}
/** Acesso a um canal: grupos pelo cargo; conversa privada só para os dois participantes (o Adm lê pelo painel de admin). */
export function canAccessChannel(me: { id: number; roles: readonly Role[] }, key: string): boolean {
  if (key.startsWith("dm:")) return dmOther(key, me.id) !== null;
  return canUseChannel(me.roles, key);
}
