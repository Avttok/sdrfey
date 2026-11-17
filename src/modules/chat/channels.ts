import type { Role } from "@/config/roles";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"] as const;
export type ChannelKey = "geral" | "user" | "seller" | "manager";
export const CHANNELS: { key: ChannelKey; label: string; hint: string }[] = [
  { key: "geral", label: "Geral", hint: "Todos do sistema" },
  { key: "user", label: "SDR", hint: "Só quem é SDR" },
  { key: "seller", label: "Vendedores", hint: "Só quem é Vendedor" },
  { key: "manager", label: "Gestores", hint: "Só quem é Gestor" },
];

/** Canais que a conta acessa: o Geral e o grupo de cada cargo dela. O Adm acessa todos. */
export function channelsFor(roles: readonly Role[]): { key: ChannelKey; label: string; hint: string }[] {
  const admin = roles.includes("admin");
  return CHANNELS.filter((c) => c.key === "geral" || admin || roles.includes(c.key as Role));
}
export const canUseChannel = (roles: readonly Role[], key: string) => channelsFor(roles).some((c) => c.key === key);
