import { AtSign, Bell, Coins, Handshake, Medal, Target, CalendarCheck, type LucideIcon } from "lucide-react";

export type NotifKind = "mencao" | "negociacao" | "meta" | "conquista" | "visita" | "moedas" | "sistema";
export const NOTIF_META: Record<NotifKind, { icon: LucideIcon; color: string; label: string }> = {
  mencao: { icon: AtSign, color: "#8b5cf6", label: "Menção" },
  negociacao: { icon: Handshake, color: "#06b6d4", label: "Negociação" },
  meta: { icon: Target, color: "#f59e0b", label: "Meta" },
  conquista: { icon: Medal, color: "#eab308", label: "Conquista" },
  visita: { icon: CalendarCheck, color: "#22c55e", label: "Visita" },
  moedas: { icon: Coins, color: "#f59e0b", label: "Moedas" },
  sistema: { icon: Bell, color: "#3b82f6", label: "Sistema" },
};
export type NotifView = { id: number; kind: NotifKind; title: string; body: string | null; href: string | null; read: boolean; at: string };
