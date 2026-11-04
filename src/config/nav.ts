import { Gauge, History, Play, Users, UserRound, type LucideIcon } from "lucide-react";
import type { Role } from "./roles";

export type NavItem = { href: string; label: string; icon: LucideIcon; role: Role };

/**
 * Menu do sistema. Para criar uma página nova: crie a pasta em src/app/(app)/ e
 * acrescente uma linha aqui. O cargo mínimo controla quem enxerga o item.
 */
export const NAV: NavItem[] = [
  { href: "/painel", label: "Painel", icon: Gauge, role: "user" },
  { href: "/atender", label: "Começar", icon: Play, role: "user" },
  { href: "/leads", label: "Leads", icon: Users, role: "user" },
  { href: "/historico", label: "Meu histórico", icon: History, role: "user" },
  { href: "/conta", label: "Minha conta", icon: UserRound, role: "user" },
];
